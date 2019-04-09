from datetime import datetime
import json
import logging
import random
import re
import unittest
import utils
import yaml

from prance import ResolvingParser


class integration_tests(unittest.TestCase):
    @classmethod
    def setup(cls, config_path, openapi_path):
        with open(config_path) as config_file:
            config = json.load(config_file)
            cls.base_url = utils.setup_base_url(config)
            cls.session = utils.setup_session(config)
            cls.test_cases = config['test_cases']

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
            utils.check_schema(self, response, schema)
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
            utils.check_schema(self, response, schema)

    def check_schema(self, params, endpoint='/notes'):
        response = utils.make_request(self, endpoint, 200, params=params)
        schema = utils.get_resource_schema(self, 'NoteResource')
        utils.check_schema(self, response, schema)
        return response

    # Test case: GET /notes?studentId=
    def test_get_notes_query_by_student_id(self, endpoint='/notes'):
        for student_id in self.test_cases['valid_student_id']:
            params = {'studentId': student_id}
            response = self.check_schema(params)

            creator_ids = []
            context_types = []
            notes = []
            sources = []
            # Validating the studentId requested is the same studentId received
            for resource in response.json()['data']:
                attributes = resource['attributes']
                actual_student_id = attributes['studentId']
                self.assertEqual(actual_student_id, student_id)

                note_id = resource['id']
                match_student_id = re.match(r'(^\d{9})(\b-)', note_id)
                if match_student_id:
                    self.assertEqual(student_id, match_student_id.group(1))
                else:
                    self.fail('Note id don\'t include a student id number')

                creator_ids.append(attributes['creatorId'])
                context_types.append(attributes['context']['contextType'])
                notes.append(attributes['note'])
                sources.append(attributes['source'])

            self.query_creator_id(student_id, creator_ids)
            self.query_string_search(student_id, notes)
            self.query_sort_keys(student_id)
            self.query_source(student_id, sources)
            self.query_context_type(student_id, context_types)

    def test_get_notes_query_non_existing_student_id(self, endpoint='/notes'):
        for student_id in self.test_cases['non_existing_student_id']:
            params = {'studentId': student_id}
            response = self.check_schema(params)

        invalid_student_ids = random.sample(range(0, 99999999), 5)
        # invalid tests returns 400
        for student_id in invalid_student_ids:
            params = {'studentId': student_id}
            response = utils.make_request(self, endpoint, 400, params=params)
            schema = utils.get_resource_schema(self, 'Error')
            utils.check_schema(self, response, schema)

    # /notes?studentId=111111111&creatorId
    def query_creator_id(self, student_id, creator_ids, endpoint='/notes'):
        for creator_id in creator_ids:
            params = {'studentId': student_id, 'creatorId': creator_id}
            response = self.check_schema(params)
            # Validating the creatorId requested is the same creatorId received
            for resource in response.json()['data']:
                actual_creator_id = resource['attributes']['creatorId']
                self.assertEqual(actual_creator_id, creator_id)

    def query_string_search(self, student_id, notes, endpoint='/notes'):
        for note in notes:
            q = random.choice(note.split(' '))
            params = {'studentId': student_id, 'q': q}
            response = self.check_schema(params)
            # Validating the search word requested exist in the notes received
            for resource in response.json()['data']:
                actual_note = resource['attributes']['note']
                self.assertIn(q, actual_note)

    def query_sort_keys(self, student_id, endpoint='/notes'):
        sort_keys = ['lastModified', 'source', 'permissions', 'contextType']
        for sort_key in sort_keys:
            params = {'studentId': student_id, 'sortKey': sort_key}
            response = self.check_schema(params)
            # Validating each sort_key
            if sort_key == 'lastModified':
                self.check_time_sort(response.json()['data'])
            elif sort_key == 'source' or sort_key == 'permissions':
                self.check_alphabetical_sort(response.json()['data'], sort_key)
            elif sort_key == 'contextType':
                self.check_context_type_sort(response.json()['data'])

    def check_time_sort(self, response):
        last_modified = response[0]['attributes']['lastModified']
        greater_element = datetime.strptime(last_modified,
                                            '%Y-%m-%dT%H:%M:%S.%f%z')
        for resource in response:
            current_element = datetime.strptime(last_modified,
                                                '%Y-%m-%dT%H:%M:%S.%f%z')
            self.assertGreaterEqual(greater_element, current_element)
            greater_element = current_element

    def check_alphabetical_sort(self, response, sort_key):
        greater_element = response[0]['attributes'][sort_key]
        for resource in response:
            current_element = resource['attributes'][sort_key]
            self.assertGreaterEqual(current_element, greater_element)
            greater_element = current_element

    def check_context_type_sort(self, response):
        greater_element = response[0]['attributes']['context']['contextType']
        for resource in response:
            current_element = resource['attributes']['context']['contextType']
            self.assertGreaterEqual(current_element, greater_element)
            greater_element = current_element

    def query_source(self, student_id, sources, endpoint='/notes'):
        for source in sources:
            params = {'studentId': student_id, 'sources': source}
            response = self.check_schema(params)
            # Validating the source requested is the same source
            for resource in response.json()['data']:
                actual_source = resource['attributes']['source']
                self.assertEqual(actual_source, source)

    def query_context_type(self, student_id, context_types, endpoint='/notes'):
        for context_type in context_types:
            params = {'studentId': student_id, 'contextTypes': context_type}
            response = self.check_schema(params)
            # Validating the contextTypes requested
            # is the same contextTypes received
            for resource in response.json()['data']:
                context = resource['attributes']['context']
                actual_context_type = context['contextType']
                self.assertEqual(actual_context_type, context_type)


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
