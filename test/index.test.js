'use strict';

const assert = require('chai').assert;
const fs = require('fs');
const hoek = require('hoek');
const path = require('path');

const TEST_YAML_FOLDER = path.resolve(__dirname, 'data');
const VALID_FULL_TEMPLATE_PATH = path.resolve(TEST_YAML_FOLDER, 'valid_full_template.yaml');
const BAD_STRUCTURE_TEMPLATE_PATH = path.resolve(TEST_YAML_FOLDER, 'bad_structure_template.yaml');

describe('index test', () => {
    let validator;

    beforeEach(() => {
        /* eslint-disable global-require */
        validator = require('../index');
        /* eslint-enable global-require */
    });

    it('parses a valid yaml', () => {
        const yamlString = fs.readFileSync(VALID_FULL_TEMPLATE_PATH);

        return validator(yamlString)
        .then((config) => {
            assert.isObject(config);

            assert.deepEqual(config, {
                errors: [],
                template: {
                    config: {
                        environment: {
                            KEYNAME: 'value'
                        },
                        image: 'image_name:image_tag',
                        secrets: [
                            'SECRET_NAME'
                        ],
                        steps: [
                            {
                                first_step: 'first_command'
                            },
                            {
                                second_step: './second_script.sh'
                            }
                        ]
                    },
                    description: 'template description',
                    maintainer: 'name@domain.suffix',
                    name: 'template_namespace/template_name',
                    version: '1.2.3'
                }
            });
        });
    });

    it('validates a poorly structured template', () => {
        const yamlString = fs.readFileSync(BAD_STRUCTURE_TEMPLATE_PATH);

        return validator(yamlString)
        .then((result) => {
            assert.deepEqual(result.template, {
                config: {
                    environment: {
                        KEYNAME: 'value'
                    },
                    image: 1,
                    secrets: [
                        'SECRET_NAME'
                    ],
                    steps: [
                        {
                            first_step: 'first_command'
                        },
                        {
                            second_step: './second_script.sh'
                        }
                    ]
                },
                maintainer: 'name@domain.suffix',
                name: 'template_namespace/template_name',
                version: '1.2.3'
            });
            assert.strictEqual(result.errors.length, 2);

            // check required description
            const missingField = hoek.reach(result.template, result.errors[0].path[0]);

            assert.strictEqual(result.errors[0].message, '"description" is required');
            assert.isUndefined(missingField);

            // check incorrect type
            const chain = `${result.errors[1].path[0]}.${result.errors[1].path[1]}`;
            const incorrectType = hoek.reach(result.template, chain);

            assert.strictEqual(result.errors[1].message, '"image" must be a string');
            assert.isNumber(incorrectType);
        }, assert.fail);
    });

    it('throws when parsing incorrectly formatted yaml', () => {
        const yamlString = 'main: :';

        return validator(yamlString)
        .then(assert.fail, (err) => {
            assert.match(err, /YAMLException/);
        });
    });
});
