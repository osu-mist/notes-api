import json
import logging
import random
import re
import unittest
import yaml

from datetime import datetime
from prance import ResolvingParser

import utils


class integration_tests(unittest.TestCase):
    @classmethod
    def setup(cls, config_path, openapi_path):
        with open(config_path) as config_file:
            config = json.load(config_file)
            cls.base_url = utils.setup_base_url(config)
            cls.session = utils.setup_session(config)
            cls.test_cases = config['test_cases']
            cls.local_test = config['local_test']

        with open(openapi_path) as openapi_file:
            openapi = yaml.load(openapi_file, Loader=yaml.SafeLoader)
            if 'swagger' in openapi:
                backend = 'flex'
            elif 'openapi' in openapi:
                backend = 'openapi-spec-validator'
            else:
                exit('Error: could not determine openapi document version')

        parser = ResolvingParser(openapi_path, backend=backend)
        cls.openapi = parser.specification

    @classmethod
    def cleanup(cls):
        cls.session.close()

    # Test case: GET /notes/{id}
    # Get a note by its noteID
    def test_get_notes_path(self, endpoint='/notes'):
        # valid tests returns 200
        for note_id in self.test_cases['valid_note_ids']:
            response = utils.make_request(self, f'{endpoint}/{note_id}', 200)
            schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, schema, None)
            # Validating the note id requested is the same note id received
            response_data = response.json()['data']
            actual_note_id = response_data['id']
            self.assertEqual(actual_note_id, note_id)
            # Validating the note received belong to the student id
            # fetching the first 9 digits of the note id
            # fails if it does not have 9 digit id with '-random_tring'
            match_student_id = re.match(r'^(\d{9})-.+', note_id)
            if match_student_id:
                actual_student_id = response_data['attributes']['studentId']
                self.assertEqual(actual_student_id, match_student_id.group(1))
            else:
                self.fail('Note id don\'t include a 9 digit student id number')

        # invalid tests returns 404
        invalid_note_ids = ['930000000', '111111111', 'Hello', '-123']
        for note_id in invalid_note_ids:
            response = utils.make_request(self, f'{endpoint}/{note_id}', 404)
            schema = utils.get_resource_schema(self, 'Error')
            utils.check_schema(self, response, schema, None)

    def get_response(self, params):
        response = utils.make_request(self, '/notes', 200, params=params)
        schema = utils.get_resource_schema(self, 'NoteResource')
        utils.check_schema(self, response, schema, None)
        return response

    # Test case: GET /notes?studentId
    def test_get_notes_query_by_student_id(self, endpoint='/notes'):
        for student_id in self.test_cases['valid_student_id']:
            params = {'studentId': student_id}
            response = self.get_response(params)

            creator_ids = set()
            context_types = set()
            notes = set()
            sources = set()
            # Validating the studentId requested is the same studentId received
            for resource in response.json()['data']:
                attributes = resource['attributes']
                actual_student_id = attributes['studentId']
                self.assertEqual(actual_student_id, student_id)

                note_id = resource['id']
                match_student_id = re.match(r'^(\d{9})-.+', note_id)
                if match_student_id:
                    self.assertEqual(student_id, match_student_id.group(1))
                else:
                    self.fail('Note id don\'t include a 9 digit student id')

                creator_ids.add(attributes['creatorId'])
                context_types.add(attributes['context']['contextType'])
                notes.add(attributes['note'])
                sources.add(attributes['source'])

            if len(response.json()['data']) > 1:
                if len(creator_ids) > 1:
                    self.query_creator_id(student_id, creator_ids)
                if len(sources) > 1:
                    self.query_source(student_id, sources)
                if len(context_types) > 1:
                    self.query_context_type(student_id, context_types)

                self.query_string_search(student_id, notes)
                self.query_sort_keys(student_id)

    # invalid tests returns 400
    def test_get_notes_query_invalid_student_ids(self, endpoint='/notes'):
        invalid_student_ids = random.sample(self.test_cases['invalid_ids'], 4)
        for student_id in invalid_student_ids:
            params = {'studentId': student_id}
            response = utils.make_request(self, endpoint, 400, params=params)
            schema = utils.get_resource_schema(self, 'Error')
            utils.check_schema(self, response, schema, None)

    def invalid_request_test(self, student_id, querry, param):
        params = {'studentId': student_id, querry: param}
        response = utils.make_request(self, '/notes', 400, params=params)
        schema = utils.get_resource_schema(self, 'Error')
        utils.check_schema(self, response, schema, None)

    def query_creator_id(self, student_id, creator_ids, endpoint='/notes'):
        for creator_id in creator_ids:
            params = {'studentId': student_id, 'creatorId': creator_id}
            response = self.get_response(params)
            # Validating the creatorId requested is the same creatorId received
            for resource in response.json()['data']:
                actual_creator_id = resource['attributes']['creatorId']
                self.assertEqual(actual_creator_id, creator_id)

        # invalid tests returns 400
        invalid_creator_id = random.choice(self.test_cases['invalid_ids'])
        params = {'studentId': student_id, 'creatorId': invalid_creator_id}
        self.invalid_request_test(student_id, 'creatorId', invalid_creator_id)

    def query_string_search(self, student_id, notes, endpoint='/notes'):
        for note in notes:
            q = random.choice(note.split(' '))
            params = {'studentId': student_id, 'q': q}
            response = self.get_response(params)
            # Validating the search word requested exist in the notes received
            for resource in response.json()['data']:
                actual_note = resource['attributes']['note']
                self.assertIn(q, actual_note)

    def query_sort_keys(self, student_id, endpoint='/notes'):
        sort_keys = ['lastModified', 'source', 'permissions', 'contextType']
        for sort_key in sort_keys:
            params = {'studentId': student_id, 'sortKey': sort_key}
            response = self.get_response(params)
            # Validating each sort_key
            if sort_key == 'lastModified':
                self.check_time_sort(response.json()['data'])
            elif sort_key in ['source', 'permissions']:
                self.check_alphabetical_sort(response.json()['data'], sort_key)
            elif sort_key == 'contextType':
                self.check_context_type_sort(response.json()['data'])

        # invalid sortKey tests returns 400
        invalid_sources = [" ", "lastmodified", "random", "contexttype"]
        invalid_source = random.choice(invalid_sources)
        self.invalid_request_test(student_id, 'sortKey', invalid_source)

    def check_time_sort(self, response):
        format = '%Y-%m-%dT%H:%M:%S.%f%z'
        if len(response) > 0:
            last_modified = response[0]['attributes']['lastModified']
            greater_element = datetime.strptime(last_modified, format)
            for resource in response:
                current_element = resource['attributes']['lastModified']
                current_element = datetime.strptime(current_element, format)
                self.assertGreaterEqual(greater_element, current_element)
                greater_element = current_element
        else:
            self.assertEqual(response, [])

    def check_alphabetical_sort(self, response, sort_key):
        if len(response) > 0:
            greater_element = response[0]['attributes'][sort_key]
            for resource in response:
                current_element = resource['attributes'][sort_key]
                self.assertGreaterEqual(current_element, greater_element)
                greater_element = current_element
        else:
            self.assertEqual(response, [])

    def check_context_type_sort(self, response):
        if len(response) > 0:
            attributes = response[0]['attributes']
            greater_element = attributes['context']['contextType']
            for resource in response:
                attributes = resource['attributes']
                current_element = attributes['context']['contextType']
                self.assertGreaterEqual(current_element, greater_element)
                greater_element = current_element
        else:
            self.assertEqual(response, [])

    def query_source(self, student_id, sources, endpoint='/notes'):
        for source in sources:
            params = {'studentId': student_id, 'sources': source}
            response = self.get_response(params)
            # Validating the source requested is the same source
            for resource in response.json()['data']:
                actual_source = resource['attributes']['source']
                self.assertEqual(actual_source, source)
        # Check more than one source at a time
        if len(sources) > 0:
            sample_numbers = random.randint(1, len(sources))
            rand_sources = random.sample(sources, sample_numbers)
            sources = ",".join(rand_sources)
            params = {'studentId': student_id, 'sources': sources}
            response = self.get_response(params)
            for resource in response.json()['data']:
                actual_source = resource['attributes']['source']
                self.assertIn(actual_source, sources)

        # invalid sources tests returns 400
        invalid_sources = [" ", "advisorportal", "random", "degreeworks"]
        invalid_source = random.choice(invalid_sources)
        params = {'studentId': student_id, 'sources': invalid_source}
        response = utils.make_request(self, endpoint, 400, params=params)
        schema = utils.get_resource_schema(self, 'Error')
        utils.check_schema(self, response, schema, None)

    def query_context_type(self, student_id, context_types, endpoint='/notes'):
        for context_type in context_types:
            params = {'studentId': student_id, 'contextTypes': context_type}
            response = self.get_response(params)
            # Validating the contextTypes requested
            # is the same contextTypes received
            for resource in response.json()['data']:
                context = resource['attributes']['context']
                actual_context_type = context['contextType']
                self.assertEqual(actual_context_type, context_type)
        # Check more than one contextType at a time
        sample_numbers = random.randint(0, len(context_types))
        rand_context_type = random.sample(context_types, sample_numbers)
        context_types = ",".join(rand_context_type)
        params = {'studentId': student_id, 'contextTypes': context_types}
        response = self.get_response(params)
        for resource in response.json()['data']:
            context = resource['attributes']['context']
            actual_context_type = context['contextType']
            self.assertIn(actual_context_type, context_types)


if __name__ == '__main__':
    arguments, argv = utils.parse_arguments()

    # Setup logging level
    if arguments.debug:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    integration_tests.setup(arguments.config_path, arguments.openapi_path)
    unittest.main(argv=argv)
    integration_tests.cleanup()
