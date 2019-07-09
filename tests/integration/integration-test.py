from itertools import chain, combinations
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

    def get_response(
            self,
            params={},
            status=200,
            resource='NoteResource',
            endpoint=''
    ):
        return utils.test_endpoint(
            self,
            f'/notes{endpoint}',
            resource,
            status,
            params,
            ['context']
        )

    # Test case: GET /notes/{id}
    def test_get_note_by_id(self):
        for note_id in self.test_cases['valid_note_ids']:
            with self.subTest('Test valid note IDs', note_id=note_id):
                response = self.get_response(endpoint=f'/{note_id}')
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
                self.get_response(
                    status=404,
                    resource='Error',
                    endpoint=f'/{note_id}'
                )

    # Test case: GET /notes?studentId
    def test_get_notes(self):
        for student_id in self.test_cases['valid_student_ids']:
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
                self.assertIsNotNone(
                    match_student_id,
                    f'noteId {note_id} did not match expected format'
                )
                self.assertEqual(match_student_id.group(1), student_id)

                creator_ids.add(attributes['creatorId'])
                if attributes['context']:
                    context_types.add(attributes['context']['contextType'])
                notes.add(attributes['note'])
                sources.add(attributes['source'])

            if response.json()['data']:
                with self.subTest(
                    'filter by creatorId',
                    student_id=student_id
                ):
                    self.query_creator_id(student_id, creator_ids)

                with self.subTest('filter by source', student_id=student_id):
                    self.query_source(student_id, sources)

                with self.subTest(
                    'filter by contextType',
                    student_id=student_id
                ):
                    self.query_context_type(student_id, context_types)

                with self.subTest('filter by q', student_id=student_id):
                    self.query_string_search(student_id, notes)

                with self.subTest('query by sortKey', student_id=student_id):
                    self.query_sort_keys(student_id)
            else:
                logging.warning(f'No notes found for studentId {student_id}')

    # invalid tests returns 400
    def test_get_notes_invalid_student_ids(self, endpoint='/notes'):
        invalid_student_ids = self.test_cases['invalid_student_ids']
        for student_id in invalid_student_ids:
            self.get_response({'studentId': student_id}, 400, 'Error')

    def query_creator_id(self, student_id, creator_ids, endpoint='/notes'):
        for creator_id in creator_ids:
            params = {'studentId': student_id, 'creatorId': creator_id}
            response = self.get_response(params)
            # Validating the creatorId requested is the same creatorId received
            for resource in response.json()['data']:
                actual_creator_id = resource['attributes']['creatorId']
                self.assertEqual(actual_creator_id, creator_id)

        # invalid tests returns 400
        for invalid_creator_id in self.test_cases['invalid_student_ids']:
            params = {'studentId': student_id, 'creatorId': invalid_creator_id}
            self.get_response(params, 400, 'Error')

    def query_string_search(self, student_id, notes, endpoint='/notes'):
        for note in notes:
            start_idx = random.randint(0, len(note) - 1)
            end_idx = random.randint(start_idx + 1, len(note))
            q = note[start_idx:end_idx]
            params = {'studentId': student_id, 'q': q}
            response = self.get_response(params)
            # Validating the search word requested exist in the notes received
            self.assertGreater(len(response.json()['data']), 0)
            self.assertIn(
                note,
                list(map(
                    lambda x: x['attributes']['note'],
                    response.json()['data']
                ))
            )
            for resource in response.json()['data']:
                actual_note = resource['attributes']['note']
                self.assertIn(q, actual_note)

    def query_sort_keys(self, student_id, endpoint='/notes'):
        sort_keys = ['lastModified', 'source', 'permissions', 'contextType']
        for sort_key in sort_keys:
            params = {'studentId': student_id, 'sortKey': sort_key}
            data = self.get_response(params).json()['data']
            # Validating each sort_key
            if len(data) > 1:
                if sort_key == 'lastModified':
                    self.check_time_sort(data)
                elif sort_key in ['source', 'permissions']:
                    self.check_alphabetical_sort(data, sort_key)
                elif sort_key == 'contextType':
                    self.check_context_type_sort(data)

        # invalid sortKey tests returns 400
        invalid_sort_keys = [' ', 'lastmodified', 'random', 'contexttype']
        for invalid_sort_key in invalid_sort_keys:
            params = {'studentId': student_id, 'sortKey': invalid_sort_key}
            self.get_response(params, 400, 'Error')

    def check_time_sort(self, response):
        format = '%Y-%m-%dT%H:%M:%S.%f%z'
        last_modified = response[0]['attributes']['lastModified']
        prev_element = datetime.strptime(last_modified, format)
        for resource in response:
            current_element = resource['attributes']['lastModified']
            current_element = datetime.strptime(current_element, format)
            self.assertGreaterEqual(prev_element, current_element)
            prev_element = current_element

    def check_alphabetical_sort(self, response, sort_key):
        prev_element = response[0]['attributes'][sort_key]
        for resource in response:
            current_element = resource['attributes'][sort_key]
            self.assertGreaterEqual(current_element, prev_element)
            prev_element = current_element

    def check_context_type_sort(self, response):
        prev_element = None
        for resource in response:
            context = resource['attributes']['context']
            if context:
                context_type = context['contextType']
                if prev_element:
                    self.assertGreaterEqual(context_type, prev_element)
                prev_element = context_type

    def query_source(self, student_id, sources):
        for source in sources:
            params = {'studentId': student_id, 'sources': source}
            response = self.get_response(params)
            # Validating the source requested is the same source
            for resource in response.json()['data']:
                actual_source = resource['attributes']['source']
                self.assertEqual(actual_source, source)
        # Check more than one source at a time
        if len(sources) > 1:
            num_sources = random.randint(2, len(sources))
            sources_sample = random.sample(sources, num_sources)
            sources = ','.join(sources_sample)
            params = {'studentId': student_id, 'sources': sources}
            response = self.get_response(params)
            for resource in response.json()['data']:
                actual_source = resource['attributes']['source']
                self.assertIn(actual_source, sources_sample)

    def query_context_type(self, student_id, context_types, endpoint='/notes'):
        for context_type in context_types:
            params = {'studentId': student_id, 'contextTypes': context_type}
            response = self.get_response(params)
            # Validating the contextType requested is the same contextType
            # received
            for resource in response.json()['data']:
                context = resource['attributes']['context']
                actual_context_type = context['contextType']
                self.assertEqual(actual_context_type, context_type)

        def powerset_list(iterable):
            """Get the powerset of an iterable as a list of lists.
            Order is not guaranteed. Example:
            [1, 2, 3] -> [[], [1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]

            :param iterable: an iterable such as a list
            :returns: The powerset as a list of lists
            """
            s = list(iterable)
            tuples = chain.from_iterable(
                combinations(s, r) for r in range(len(s)+1)
            )
            return list(map(lambda x: list(x), tuples))

        # Test subsets of context_types with length 2 or more
        subsets = list(x for x in powerset_list(context_types) if len(x) > 1)
        # Limit the number of subsets to 10
        if len(subsets) > 10:
            subsets = random.sample(subsets, 10)
        for subset in subsets:
            context_types = ','.join(subset)
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
