'use strict';

const { assert } = require('chai');
const fs = require('fs');
const hoek = require('@hapi/hoek');
const path = require('path');
const sinon = require('sinon');

const VALID_FULL_TEMPLATE_PATH = 'valid_full_template.yaml';
const VALID_EXTENDED_STEPS_TEMPLATE_PATH = 'valid_extended_steps_template.yaml';
const VALID_PARENT_TEMPLATE_PATH = 'valid_parent_template.yaml';
const VALID_PARENT_LOCKED_TEMPLATE_PATH = 'valid_parent_and_locked_step_template.yaml';
const VALID_ORDER_TEMPLATE_PATH = 'valid_order_template.yaml';
const VALID_ORDER_NO_STEPS_TEMPLATE_PATH = 'valid_order_no_steps_template.yaml';
const INVALID_ORDER_TEMPLATE_PATH = 'invalid_order_template.yaml';
const VALID_ORDER_WRONG_TEARDOWN_TEMPLATE_PATH = 'valid_order_and_wrong_teardown_template.yaml';
const VALID_ORDER_WITH_WARNINGS_PATH = 'valid_order_and_warnings_template.yaml';
const VALID_ORDER_WITH_LOCKED_STEP_PATH = 'valid_order_and_locked_step_template.yaml';
const BAD_STRUCTURE_TEMPLATE_PATH = 'bad_structure_template.yaml';
const BAD_ORDER_TEMPLATE_PATH = 'bad_order_missing_locked_step_template.yaml';
const CHILD_TEMPLATE_WITH_PARAMS = 'child_template_with_params.yaml';

const VALID_FULL_PIPELINE_TEMPLATE_PATH = 'valid_full_pipeline_template.yaml';
const BAD_STRUCTURE_PIPELINE_TEMPLATE_PATH = 'bad_structure_pipeline_template.yaml';

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
    let validator;
    let template;
    let templateLockedStep;

    describe('parse job template', () => {
        const templateFactoryMock = {
            getTemplate: sinon.stub(),
            getFullNameAndVersion: sinon.stub()
        };

        beforeEach(() => {
            template = JSON.parse(loadData('template.json'));
            templateLockedStep = JSON.parse(loadData('template_locked_step.json'));

            templateFactoryMock.getTemplate.resolves(template);
            // eslint-disable-next-line global-require
            validator = require('../index').parseJobTemplate;
        });

        it('parses a valid yaml', () =>
            validator(loadData(VALID_FULL_TEMPLATE_PATH), templateFactoryMock).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('valid_full_template.json')));
            }));

        it('parses a valid yaml wtih extended steps', () =>
            validator(loadData(VALID_EXTENDED_STEPS_TEMPLATE_PATH), templateFactoryMock).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('valid_extended_steps_template.json')));
            }));

        it('parses a valid yaml using a parent template with locked step', () => {
            templateFactoryMock.getTemplate.resolves(templateLockedStep);

            return validator(loadData(VALID_PARENT_LOCKED_TEMPLATE_PATH), templateFactoryMock).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('valid_parent_and_locked_step_template.json')));
            });
        });

        it('parses a valid yaml using a parent template', () =>
            validator(loadData(VALID_PARENT_TEMPLATE_PATH), templateFactoryMock).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('valid_parent_template.json')));
            }));

        it('parses a valid yaml using a parent template with order', () =>
            validator(loadData(VALID_ORDER_TEMPLATE_PATH), templateFactoryMock).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('valid_order_template.json')));
            }));

        it('parses a valid yaml using a parent template with order and no steps defined', () =>
            validator(loadData(VALID_ORDER_NO_STEPS_TEMPLATE_PATH), templateFactoryMock).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('valid_order_no_steps_template.json')));
            }));

        it('parses a valid yaml using a parent template with order and wrong teardown', () =>
            validator(loadData(VALID_ORDER_WRONG_TEARDOWN_TEMPLATE_PATH), templateFactoryMock).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('valid_order_and_wrong_teardown_template.json')));
            }));

        it('parses a valid yaml with invalid order', () =>
            validator(loadData(INVALID_ORDER_TEMPLATE_PATH), templateFactoryMock).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('invalid_order_template.json')));
            }));

        it('parses a valid yaml using a parent template with order and warnings', () =>
            validator(loadData(VALID_ORDER_WITH_WARNINGS_PATH), templateFactoryMock).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('valid_order_and_warnings_template.json')));
            }));

        it('parses a valid yaml using a parent template with order and locked step', () => {
            templateFactoryMock.getTemplate.resolves(templateLockedStep);

            return validator(loadData(VALID_ORDER_WITH_LOCKED_STEP_PATH), templateFactoryMock).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('valid_order_and_locked_step_template.json')));
            });
        });

        it('throws when template does not exist', () => {
            templateFactoryMock.getTemplate.resolves(null);

            return validator(loadData(VALID_PARENT_TEMPLATE_PATH), templateFactoryMock).then(assert.fail, err => {
                assert.match(err, /Template template_namespace\/parent@1 does not exist/);
            });
        });

        it('throws when order does not contain locked steps', () => {
            templateFactoryMock.getTemplate.resolves(templateLockedStep);

            return validator(loadData(BAD_ORDER_TEMPLATE_PATH), templateFactoryMock).then(assert.fail, err => {
                // eslint-disable-next-line max-len
                assert.match(err, /Order must contain template template_namespace\/parent@1 locked steps: security/);
            });
        });

        it('validates a poorly structured template', () =>
            validator(loadData(BAD_STRUCTURE_TEMPLATE_PATH)).then(result => {
                assert.deepEqual(result.template, JSON.parse(loadData('bad_structure_template.json')));
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
            }, assert.fail));

        it('throws when parsing incorrectly formatted yaml', () =>
            validator('main: :', templateFactoryMock).then(assert.fail, err => {
                assert.match(err, /YAMLException/);
            }));

        it('composing templates merges parameters as well', () =>
            validator(loadData(CHILD_TEMPLATE_WITH_PARAMS), templateFactoryMock).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('child_template_with_params.json')));
            }));
    });

    describe('parse pipeline template', () => {
        beforeEach(() => {
            // eslint-disable-next-line global-require
            validator = require('../index').parsePipelineTemplate;
        });

        it('parses a valid yaml', () =>
            validator(loadData(VALID_FULL_PIPELINE_TEMPLATE_PATH)).then(config => {
                assert.isObject(config);
                assert.deepEqual(config, JSON.parse(loadData('valid_full_pipeline_template.json')));
            }));

        it('validates a poorly structured template', () =>
            validator(loadData(BAD_STRUCTURE_PIPELINE_TEMPLATE_PATH)).then(result => {
                assert.deepEqual(result.template, JSON.parse(loadData('bad_structure_pipeline_template.json')));
                assert.strictEqual(result.errors.length, 2);

                // check required description
                const missingField = hoek.reach(result.template, result.errors[0].path[0]);

                assert.strictEqual(result.errors[0].message, '"description" is required');
                assert.isUndefined(missingField);

                // check incorrect type
                const chain = `${result.errors[1].path[0]}.${result.errors[1].path[1]}`;
                const incorrectType = hoek.reach(result.template, chain).image;

                assert.strictEqual(result.errors[1].message, '"config.shared.image" must be a string');
                assert.isNumber(incorrectType);
            }, assert.fail));

        it('throws when parsing incorrectly formatted yaml', () =>
            validator('main: :').then(assert.fail, err => {
                assert.match(err, /YAMLException/);
            }));
    });
});
