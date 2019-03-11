import json
import logging
import unittest
import yaml

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
        for note_id in self.test_cases['valid_notes_id']:
            response = utils.make_request(self, f'{endpoint}/{note_id}', 200)
            schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, schema)
            # Validating the note id requested is the same note id received
            response_data = response.json()['data']
            actual_note_id = response_data['id']
            self.assertEqual(actual_note_id, note_id)

        # invalid tests returns 404
        for note_id in self.test_cases['invalid_notes_id']:
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
            # Validating the note id requested is the same note id received
            for resource in response.json()['data']:
                attributes = resource['attributes']
                actual_student_id = attributes['studentId']
                self.assertEqual(actual_student_id, student_id)
            self.query_creator_id(student_id)
            self.query_context_types(student_id)
    
    def test_get_notes_query_non_existing_student_id(self, endpoint='/notes'):
        for student_id in self.test_cases['non_existing_student_id']:
            params = {'studentId': student_id}
            response = utils.make_request(self, endpoint, 200, params=params)
            note_schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, note_schema)

        # invalid tests returns 400
        for student_id in self.test_cases['invalid_student_id']:
            params = {'studentId': student_id}
            response = utils.make_request(self, endpoint, 400, params=params)
            schema = utils.get_resource_schema(self, 'Error')
            utils.check_schema(self, response, schema)

    # /notes?studentId=111111111&creatorId
    def query_creator_id(self, student_id, endpoint='/notes'):
        for creator_id in self.test_cases['valid_creator_id']:
            params = {'studentId': student_id,'creatorId': creator_id}
            response = utils.make_request(self, endpoint, 200, params=params)
            schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, schema)
            # Validating the note id requested is the same note id received
            for resource in response.json()['data']:
                attributes = resource['attributes']
                actual_creator_id = attributes['creatorId']
                self.assertEqual(actual_creator_id, creator_id)

    # /notes?studentId=111111111&contextTypes
    def query_context_types(self, student_id, endpoint='/notes'):
        for context_types in self.test_cases['valid_context_types']:
            params = {'studentId': student_id,'contextTypes': context_types}
            response = utils.make_request(self, endpoint, 200, params=params)
            schema = utils.get_resource_schema(self, 'NoteResource')
            utils.check_schema(self, response, schema)
            # Validating the note id requested is the same note id received
            for resource in response.json()['data']:
                attributes = resource['attributes']
                actual_context_types = attributes['context']
                actual_context_types = actual_context_types['contextType']
                self.assertEqual(actual_context_types, context_types)

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
