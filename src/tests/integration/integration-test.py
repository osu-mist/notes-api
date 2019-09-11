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
                    resource='ErrorObject',
                    endpoint=f'/{note_id}'
                )

    # Test case: GET /notes?filter[studentId]
    def test_get_notes(self):
        for student_id in self.test_cases['valid_student_ids']:
            params = {'filter[studentId]': student_id}
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

                with self.subTest('test sort fields', student_id=student_id):
                    self.query_sort_fields(student_id)
            else:
                logging.warning(f'No notes found for studentId {student_id}')

    # invalid tests returns 400
    def test_get_notes_invalid_student_ids(self, endpoint='/notes'):
        invalid_student_ids = self.test_cases['invalid_student_ids']
        for student_id in invalid_student_ids:
            self.get_response({'filter[studentId]': student_id}, 400, 'ErrorObject')

    def query_creator_id(self, student_id, creator_ids, endpoint='/notes'):
        for creator_id in creator_ids:
            params = {
                'filter[studentId]': student_id,
                'filter[creatorId]': creator_id
            }
            response = self.get_response(params)
            # Validating the creatorId requested is the same creatorId received
            for resource in response.json()['data']:
                actual_creator_id = resource['attributes']['creatorId']
                self.assertEqual(actual_creator_id, creator_id)

        # invalid tests returns 400
        for invalid_creator_id in self.test_cases['invalid_student_ids']:
            params = {
                'filter[studentId]': student_id,
                'filter[creatorId]': invalid_creator_id
            }
            self.get_response(params, 400, 'ErrorObject')

    def query_string_search(self, student_id, notes, endpoint='/notes'):
        for note in notes:
            start_idx = random.randint(0, len(note) - 1)
            end_idx = random.randint(start_idx + 1, len(note))
            q = note[start_idx:end_idx]
            params = {
                'filter[studentId]': student_id,
                'filter[note][fuzzy]': q
            }
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

    def query_sort_fields(self, student_id, endpoint='/notes'):
        sort_fields = ['lastModified', 'source', 'permissions', 'contextType']
        # Add sort fields with '-' prefix to test descending sort
        sort_fields.extend(list(map(lambda x: f'-{x}', sort_fields)))

        for sort_field in sort_fields:
            params = {'filter[studentId]': student_id, 'sort': sort_field}
            data = self.get_response(params).json()['data']
            # Validating each sort_field
            if len(data) > 1:
                test = (
                    self.assertGreaterEqual if not sort_field.startswith('-')
                    else self.assertLessEqual
                )
                if sort_field == 'lastModified':
                    self.check_time_sort(data, test)
                elif sort_field in ['source', 'permissions']:
                    self.check_alphabetical_sort(data, sort_field, test)
                elif sort_field == 'contextType':
                    self.check_context_type_sort(data, test)

        # invalid sort field tests return 400
        invalid_sort_fields = [' ', 'lastmodified', 'random', 'contexttype']
        for invalid_sort_field in invalid_sort_fields:
            params = {
                'filter[studentId]': student_id,
                'sort': invalid_sort_field
            }
            self.get_response(params, 400, 'ErrorObject')

    def check_time_sort(self, response, test):
        format = '%Y-%m-%dT%H:%M:%S.%f%z'
        last_modified = response[0]['attributes']['lastModified']
        prev_element = datetime.strptime(last_modified, format)
        for resource in response:
            current_element = resource['attributes']['lastModified']
            current_element = datetime.strptime(current_element, format)
            test(current_element, prev_element)
            prev_element = current_element

    def check_alphabetical_sort(self, response, sort_field, test):
        prev_element = response[0]['attributes'][sort_field]
        for resource in response:
            current_element = resource['attributes'][sort_field]
            test(current_element, prev_element)
            prev_element = current_element

    def check_context_type_sort(self, response, test):
        prev_element = None
        for resource in response:
            context = resource['attributes']['context']
            if context:
                current_element = context['contextType']
                if prev_element:
                    test(current_element, prev_element)
                prev_element = current_element

    def query_source(self, student_id, sources):
        for source in sources:
            params = {
                'filter[studentId]': student_id,
                'filter[source][oneOf]': source
            }
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
            params = {
                'filter[studentId]': student_id,
                'filter[source][oneOf]': sources
            }
            response = self.get_response(params)
            for resource in response.json()['data']:
                actual_source = resource['attributes']['source']
                self.assertIn(actual_source, sources_sample)

    def query_context_type(self, student_id, context_types, endpoint='/notes'):
        for context_type in context_types:
            params = {
                'filter[studentId]': student_id,
                'filter[contextType][oneOf]': context_type
            }
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
            params = {
                'filter[studentId]': student_id,
                'filter[contextType][oneOf]': context_types
            }
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
