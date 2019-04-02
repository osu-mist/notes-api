import json
import logging
import random
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
            student_id = (note_id.split('-'))
            actual_student_id = response_data['attributes']['studentId']
            self.assertEqual(actual_student_id, student_id[0])

        # invalid tests returns 404
        invalid_note_ids = ['930000000', '111111111', 'Hello', '-123']
        for note_id in invalid_note_ids:
            response = utils.make_request(self, f'{endpoint}/{note_id}', 404)
            schema = utils.get_resource_schema(self, 'Error')
            utils.check_schema(self, response, schema)

    # /notes?studentId=111111111
    def test_get_notes_query_by_student_id(self, endpoint='/notes'):
        for student_id in self.test_cases['valid_student_id']:
            params = {'studentId': student_id}
            response = utils.make_request(self, endpoint, 200, params=params)
            note_schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, note_schema)
            creator_ids = []
            context_types = []
            notes = []
            sources = []
            # Validating the studentId requested is the same studentId received
            for resource in response.json()['data']:
                attributes = resource['attributes']
                actual_student_id = attributes['studentId']
                self.assertEqual(actual_student_id, student_id)
                creator_ids.append(attributes['creatorId'])
                context_types.append(attributes['context']['contextType'])
                notes.append(attributes['note'])
                sources.append(attributes['source'])

            self.query_creator_id(student_id, creator_ids)
            self.query_context_types(student_id, context_types)
            self.query_string_search(student_id, notes)
            self.query_source(student_id, sources)
            self.query_sort_keys(student_id)

    def test_get_notes_query_non_existing_student_id(self, endpoint='/notes'):
        for student_id in self.test_cases['non_existing_student_id']:
            params = {'studentId': student_id}
            response = utils.make_request(self, endpoint, 200, params=params)
            note_schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, note_schema)

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
            response = utils.make_request(self, endpoint, 200, params=params)
            schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, schema)
            # Validating the creatorId requested is the same creatorId received
            for resource in response.json()['data']:
                actual_creator_id = resource['attributes']['creatorId']
                self.assertEqual(actual_creator_id, creator_id)

    # /notes?studentId=111111111&contextTypes
    def query_context_type(self, student_id, context_types, endpoint='/notes'):
        for context_type in context_types:
            params = {'studentId': student_id, 'contextTypes': context_type}
            response = utils.make_request(self, endpoint, 200, params=params)
            schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, schema)
            # Validating the contextTypes requested 
            # is the same contextTypes received
            for resource in response.json()['data']:
                actual_context_type = resource['attributes']['context']['contextType']
                self.assertEqual(actual_context_type, context_type)

    # /notes?studentId=111111111&q=
    def query_string_search(self, student_id, notes, endpoint='/notes'):
        for note in notes:
            q = random.choice(note.split(' '))
            params = {'studentId': student_id, 'q': q}
            response = utils.make_request(self, endpoint, 200, params=params)
            schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, schema)
            # Validating the search word requested exist in the notes received
            for resource in response.json()['data']:
                actual_note = resource['attributes']['note']
                self.assertIn(q, actual_note)

    # /notes?studentId=111111111&sources=
    def query_source(self, student_id, sources, endpoint='/notes'):
        for source in sources:
            params = {'studentId': student_id, 'sources': source}
            response = utils.make_request(self, endpoint, 200, params=params)
            schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, schema)
            # Validating the source requested is the same source 
            for resource in response.json()['data']:
                actual_source = resource['attributes']['source']
                self.assertEqual(actual_source, source)

    def query_sort_keys(self, student_id, endpoint='/notes'):
        sort_keys = ['lastModified', 'source', 'permissions'] # , 'contextType']
        for sort_key in sort_keys:
            params = {'studentId': student_id, 'sortKey': sort_key}
            response = utils.make_request(self, endpoint, 200, params=params)
            note_schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, note_schema)
            for resource in response.json()['data']:
                sorted_element = resource['attributes'][sort_key]

    # def isSorted(x, key = lambda x: x): 
    #     return all([key(x[i]) <= key(x[i + 1]) for i in xrange(len(x) - 1)])


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
