import json
import logging
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
            try:
                # fetching the first 9 digits of the note id
                # fails if it does not have 9 digit id
                student_id = re.match('\d{9}', note_id).group(0)
            except (AttributeError, TypeError):
                self.fail('Note id don\'t include a 9 digit student id number')

            actual_student_id = response_data['attributes']['studentId']
            self.assertEqual(actual_student_id, student_id)

        # invalid tests returns 404
        invalid_note_ids = ['930000000', '111111111', 'Hello', '-123']
        for note_id in invalid_note_ids:
            response = utils.make_request(self, f'{endpoint}/{note_id}', 404)
            schema = utils.get_resource_schema(self, 'Error')
            utils.check_schema(self, response, schema)


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
