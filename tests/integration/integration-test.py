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
    def tearDownClass(cls):
        cls.session.close()

    # Test case: GET /notes/{id}
    def test_get_note_by_id(self):
        endpoint = '/notes'
        nullable_fields = ['context']
        for note_id in self.test_cases['valid_note_ids']:
            with self.subTest('Test valid note IDs', note_id=note_id):
                response = utils.test_endpoint(
                    self,
                    f'{endpoint}/{note_id}',
                    'NoteResource',
                    200,
                    nullable_fields=nullable_fields
                )
                # Validate that the note id requested is the same note id
                # received
                response_data = response.json()['data']
                actual_note_id = response_data['id']
                self.assertEqual(actual_note_id, note_id)
                # Validate that the noteId contains the correct studentId
                match_student_id = re.match(r'^(\d{9})-.+', note_id)
                self.assertIsNotNone(
                    match_student_id,
                    f'noteId {note_id} did not include a 9-digit student ID'
                )
                actual_student_id = response_data['attributes']['studentId']
                self.assertEqual(actual_student_id, match_student_id.group(1))

        for note_id in self.test_cases['invalid_note_ids']:
            with self.subTest('Test invalid note IDs', note_id=note_id):
                utils.test_endpoint(
                    self,
                    f'{endpoint}/{note_id}',
                    'Error',
                    404,
                    nullable_fields=nullable_fields
                )

    def _test_notes(self, params={}, status=200, resource='NoteResource'):
        return utils.test_endpoint(
            self,
            '/notes',
            resource,
            status,
            params,
            ['context']
        )

    # Test case: GET /notes?studentId
    def test_get_notes_query_by_student_id(self):
        for student_id in self.test_cases['valid_student_ids']:
            params = {'studentId': student_id}
            response = self._test_notes(params)

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
                self.assertIsNotNone(
                    match_student_id,
                    f'noteId {note_id} did not include a 9-digit student ID'
                )
                self.assertEqual(match_student_id.group(1), student_id)

                creator_ids.add(attributes['creatorId'])
                if attributes['context']:
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
        invalid_student_ids = self.test_cases['invalid_student_ids']
        for student_id in invalid_student_ids:
            self._test_notes({'studentId': student_id}, 400, 'Error')

    def query_creator_id(self, student_id, creator_ids, endpoint='/notes'):
        for creator_id in creator_ids:
            params = {'studentId': student_id, 'creatorId': creator_id}
            response = self._test_notes(params)
            # Validating the creatorId requested is the same creatorId received
            for resource in response.json()['data']:
                actual_creator_id = resource['attributes']['creatorId']
                self.assertEqual(actual_creator_id, creator_id)

        # invalid tests returns 400
        for invalid_creator_id in self.test_cases['invalid_student_ids']:
            params = {'studentId': student_id, 'creatorId': invalid_creator_id}
            self._test_notes(params, 400, 'Error')

    def query_string_search(self, student_id, notes, endpoint='/notes'):
        for note in notes:
            q = random.choice(note.split(' '))
            params = {'studentId': student_id, 'q': q}
            response = self._test_notes(params)
            # Validating the search word requested exist in the notes received
            for resource in response.json()['data']:
                actual_note = resource['attributes']['note']
                self.assertIn(q, actual_note)

    def query_sort_keys(self, student_id, endpoint='/notes'):
        sort_keys = ['lastModified', 'source', 'permissions', 'contextType']
        for sort_key in sort_keys:
            params = {'studentId': student_id, 'sortKey': sort_key}
            data = self._test_notes(params).json()['data']
            # Validating each sort_key
            if len(data) > 1:
                if sort_key == 'lastModified':
                    self.check_time_sort(data)
                elif sort_key in ['source', 'permissions']:
                    self.check_alphabetical_sort(data, sort_key)
                elif sort_key == 'contextType':
                    self.check_context_type_sort(data)

        # invalid sortKey tests returns 400
        invalid_sources = [' ', 'lastmodified', 'random', 'contexttype']
        for invalid_source in invalid_sources:
            params = {'studentId': student_id, 'sortKey': invalid_source}
            self._test_notes(params, 400, 'Error')

    def check_time_sort(self, response):
        format = '%Y-%m-%dT%H:%M:%S.%f%z'
        last_modified = response[0]['attributes']['lastModified']
        greater_element = datetime.strptime(last_modified, format)
        for resource in response:
            current_element = resource['attributes']['lastModified']
            current_element = datetime.strptime(current_element, format)
            self.assertGreaterEqual(greater_element, current_element)
            greater_element = current_element

    def check_alphabetical_sort(self, response, sort_key):
        greater_element = response[0]['attributes'][sort_key]
        for resource in response:
            current_element = resource['attributes'][sort_key]
            self.assertGreaterEqual(current_element, greater_element)
            greater_element = current_element

    def check_context_type_sort(self, response):
        prev_context_type = None
        for resource in response:
            context = resource['attributes']['context']
            if context:
                context_type = context['contextType']
                if prev_context_type:
                    self.assertGreaterEqual(context_type, prev_context_type)
                prev_context_type = context_type

    def query_source(self, student_id, sources):
        for source in sources:
            params = {'studentId': student_id, 'sources': source}
            response = self._test_notes(params)
            # Validating the source requested is the same source
            for resource in response.json()['data']:
                actual_source = resource['attributes']['source']
                self.assertEqual(actual_source, source)
        # Check more than one source at a time
        if len(sources) > 0:
            sample_numbers = random.randint(1, len(sources))
            rand_sources = random.sample(sources, sample_numbers)
            sources = ','.join(rand_sources)
            params = {'studentId': student_id, 'sources': sources}
            response = self._test_notes(params)
            for resource in response.json()['data']:
                actual_source = resource['attributes']['source']
                self.assertIn(actual_source, sources)

        # invalid sources tests returns 400
        invalid_sources = [' ', 'advisorportal', 'random', 'degreeworks']
        for invalid_source in invalid_sources:
            params = {'studentId': student_id, 'sources': invalid_source}
            self._test_notes(params, 400, 'Error')

    def query_context_type(self, student_id, context_types, endpoint='/notes'):
        for context_type in context_types:
            params = {'studentId': student_id, 'contextTypes': context_type}
            response = self._test_notes(params)
            # Validating the contextTypes requested
            # is the same contextTypes received
            for resource in response.json()['data']:
                context = resource['attributes']['context']
                actual_context_type = context['contextType']
                self.assertEqual(actual_context_type, context_type)
        # Check more than one contextType at a time
        sample_numbers = random.randint(0, len(context_types))
        rand_context_type = random.sample(context_types, sample_numbers)
        context_types = ','.join(rand_context_type)
        params = {'studentId': student_id, 'contextTypes': context_types}
        response = self._test_notes(params)
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
