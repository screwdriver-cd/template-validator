'use strict';

const { assert } = require('chai');
const fs = require('fs');
const hoek = require('@hapi/hoek');
const path = require('path');
const sinon = require('sinon');

const VALID_FULL_TEMPLATE_PATH = 'valid_full_template.yaml';
const VALID_PARENT_TEMPLATE_PATH = 'valid_template_with_parent_template.yaml';
const VALID_TEMPLATE_PATH_WITH_ORDER = 'valid_template_with_order_template.yaml';
const VALID_TEMPLATE_PATH_WITH_ORDER_AND_WRONG_TEARDOWN =
    'valid_template_with_order_wrong_teardown_template.yaml';
const VALID_TEMPLATE_PATH_WITH_ORDER_WARNINGS = 'valid_template_with_order_warnings_template.yaml';
const BAD_STRUCTURE_TEMPLATE_PATH = 'bad_structure_template.yaml';

/**
 * Load sample data from disk
 * @method loadData
 * @param  {String} name Filename to read (inside data dir)
 * @return {String}      Contents of file
 */
function loadData(name) {
    return fs.readFileSync(path.resolve(__dirname, 'data', name), 'utf-8');
}

describe('index test', () => {
    const templateFactoryMock = {
        getTemplate: sinon.stub(),
        getFullNameAndVersion: sinon.stub()
    };
    let validator;
    let template;

    beforeEach(() => {
        template = JSON.parse(loadData('template.json'));

        templateFactoryMock.getTemplate
            .resolves(template);
        // eslint-disable-next-line global-require
        validator = require('../index');
    });

    it('parses a valid yaml', () =>
        validator(loadData(VALID_FULL_TEMPLATE_PATH), templateFactoryMock)
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
                        maintainer: 'name@domain.org',
                        name: 'template_namespace/template_name',
                        version: '1.2.3'
                    }
                });
            })
    );

    it('parses a valid yaml using a parent template', () =>
        validator(loadData(VALID_PARENT_TEMPLATE_PATH), templateFactoryMock)
            .then((config) => {
                assert.isObject(config);
                assert.deepEqual(config, {
                    errors: [],
                    template: {
                        config: {
                            annotations: {},
                            environment: {
                                BAR: 'foo',
                                FOO: 'from template',
                                KEYNAME: 'value',
                                SD_TEMPLATE_FULLNAME: 'template_namespace/parent',
                                SD_TEMPLATE_NAME: 'parent',
                                SD_TEMPLATE_NAMESPACE: 'template_namespace',
                                SD_TEMPLATE_VERSION: '1.2.3'
                            },
                            image: 'node:8',
                            secrets: [
                                'GIT_KEY',
                                'SECRET_NAME'
                            ],
                            settings: {
                                email: 'foo@example.com'
                            },
                            sourcePaths: [],
                            steps: [
                                {
                                    preinstall: 'echo Starting command'
                                },
                                {
                                    install: 'first_command'
                                },
                                {
                                    test: 'npm test'
                                },
                                {
                                    posttest: './second_script.sh'
                                },
                                {
                                    'teardown-run': 'cp -r artifacts/coverage $SD_ARTIFACTS_DIR'
                                },
                                {
                                    'teardown-always': 'echo done!'
                                }
                            ],
                            templateId: 7754
                        },
                        description: 'template description',
                        images: {
                            'latest-image': 'node:12',
                            'stable-image': 'node:10',
                            'test-image': 'node:18'
                        },
                        maintainer: 'name@domain.org',
                        name: 'template_namespace/child',
                        version: '1.2.3'
                    }
                });
            })
    );

    it('parses a valid yaml using a parent template with order', () =>
        validator(loadData(VALID_TEMPLATE_PATH_WITH_ORDER), templateFactoryMock)
            .then((config) => {
                assert.isObject(config);
                assert.deepEqual(config, {
                    errors: [],
                    template: {
                        config: {
                            annotations: {},
                            environment: {
                                BAR: 'foo',
                                FOO: 'from template',
                                KEYNAME: 'value',
                                SD_TEMPLATE_FULLNAME: 'template_namespace/parent',
                                SD_TEMPLATE_NAME: 'parent',
                                SD_TEMPLATE_NAMESPACE: 'template_namespace',
                                SD_TEMPLATE_VERSION: '1.2.3'
                            },
                            image: 'node:8',
                            secrets: [
                                'GIT_KEY',
                                'SECRET_NAME'
                            ],
                            settings: {
                                email: 'foo@example.com'
                            },
                            sourcePaths: [],
                            steps: [
                                {
                                    init: 'echo Starting command'
                                },
                                {
                                    install: './run_script.sh'
                                },
                                {
                                    test: 'npm test'
                                },
                                {
                                    finish: 'echo done!'
                                }
                            ],
                            templateId: 7754
                        },
                        description: 'template description',
                        images: {
                            'latest-image': 'node:12',
                            'stable-image': 'node:10',
                            'test-image': 'node:18'
                        },
                        maintainer: 'name@domain.org',
                        name: 'template_namespace/child',
                        version: '1.2.3'
                    }
                });
            })
    );

    it('parses a valid yaml using a parent template with order and wrong teardown', () =>
        validator(loadData(VALID_TEMPLATE_PATH_WITH_ORDER_AND_WRONG_TEARDOWN), templateFactoryMock)
            .then((config) => {
                assert.isObject(config);
                assert.deepEqual(config, {
                    errors: [],
                    template: {
                        config: {
                            annotations: {},
                            environment: {
                                BAR: 'foo',
                                FOO: 'from template',
                                KEYNAME: 'value',
                                SD_TEMPLATE_FULLNAME: 'template_namespace/parent',
                                SD_TEMPLATE_NAME: 'parent',
                                SD_TEMPLATE_NAMESPACE: 'template_namespace',
                                SD_TEMPLATE_VERSION: '1.2.3'
                            },
                            image: 'node:8',
                            secrets: [
                                'GIT_KEY',
                                'SECRET_NAME'
                            ],
                            settings: {
                                email: 'foo@example.com'
                            },
                            sourcePaths: [],
                            steps: [
                                {
                                    init: 'echo Starting command'
                                },
                                {
                                    install: './run_script.sh'
                                },
                                {
                                    test: 'npm test'
                                },
                                {
                                    finish: 'echo done!'
                                },
                                {
                                    'teardown-blah': 'echo Should be before teardown-run'
                                },
                                {
                                    'teardown-run': 'cp -r artifacts/coverage $SD_ARTIFACTS_DIR'
                                }
                            ],
                            templateId: 7754
                        },
                        description: 'template description',
                        images: {
                            'latest-image': 'node:12',
                            'stable-image': 'node:10',
                            'test-image': 'node:18'
                        },
                        maintainer: 'name@domain.org',
                        name: 'template_namespace/child',
                        version: '1.2.3'
                    }
                });
            })
    );

    it('parses a valid yaml using a parent template with order and warnings', () =>
        validator(loadData(VALID_TEMPLATE_PATH_WITH_ORDER_WARNINGS), templateFactoryMock)
            .then((config) => {
                assert.isObject(config);
                assert.deepEqual(config, {
                    errors: [],
                    template: {
                        config: {
                            annotations: {},
                            environment: {
                                BAR: 'foo',
                                FOO: 'from template',
                                KEYNAME: 'value',
                                SD_TEMPLATE_FULLNAME: 'template_namespace/parent',
                                SD_TEMPLATE_NAME: 'parent',
                                SD_TEMPLATE_NAMESPACE: 'template_namespace',
                                SD_TEMPLATE_VERSION: '1.2.3'
                            },
                            image: 'node:8',
                            secrets: [
                                'GIT_KEY',
                                'SECRET_NAME'
                            ],
                            settings: {
                                email: 'foo@example.com'
                            },
                            sourcePaths: [],
                            steps: [
                                {
                                    init: 'echo Starting command'
                                },
                                {
                                    install: './run_script.sh'
                                },
                                {
                                    test: 'npm test'
                                },
                                {
                                    finish: 'echo done!'
                                }
                            ],
                            templateId: 7754
                        },
                        description: 'template description',
                        images: {
                            'latest-image': 'node:12',
                            'stable-image': 'node:10',
                            'test-image': 'node:18'
                        },
                        maintainer: 'name@domain.org',
                        name: 'template_namespace/child',
                        version: '1.2.3'
                    },
                    warnMessages: [
                        'blah step definition not found; skipping',
                        'meow step definition not found; skipping'
                    ]
                });
            })
    );

    it('throws when template does not exist', () => {
        templateFactoryMock.getTemplate.resolves(null);

        return validator(loadData(VALID_PARENT_TEMPLATE_PATH), templateFactoryMock)
            .then(assert.fail, (err) => {
                assert.match(err, /Template template_namespace\/parent@1 does not exist/);
            });
    });

    it('validates a poorly structured template', () =>
        validator(loadData(BAD_STRUCTURE_TEMPLATE_PATH))
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
                    maintainer: 'name@domain.com',
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

                assert.strictEqual(result.errors[1].message, '"config.image" must be a string');
                assert.isNumber(incorrectType);
            }, assert.fail)
    );

    it('throws when parsing incorrectly formatted yaml', () =>
        validator('main: :', templateFactoryMock)
            .then(assert.fail, (err) => {
                assert.match(err, /YAMLException/);
            })
    );
});
