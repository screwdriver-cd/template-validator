'use strict';

const SCHEMA_CONFIG = require('screwdriver-data-schema').config.template.template;
const Yaml = require('js-yaml');

/**
 * Loads the configuration from a stringified screwdriver-template.yaml
 * @method loadTemplate
 * @param  {String} yamlString Contents of screwdriver-template.yaml
 * @return {Promise}           Promise that resolves to the template as a config object
 */
async function loadTemplate(yamlString) {
    return Yaml.safeLoad(yamlString);
}

/**
 * Validate the template configuration
 * @method validateTemplate
 * @param  {Object}         templateObj Configuration object that represents the template
 * @return {Promise}                    Promise that resolves to the passed-in config object
 */
async function validateTemplate(templateObj) {
    try {
        const data = await SCHEMA_CONFIG.validateAsync(templateObj, {
            abortEarly: false
        });

        return data;
    } catch (err) {
        throw err;
    }
}

/**
 * Parses the configuration from a screwdriver-template.yaml
 * @method parseTemplate
 * @param  {String}  yamlString Contents of screwdriver-template.yaml
 * @return {Promise}            Promise that rejects if the configuration cannot be parsed
 *                              The promise will eventually resolve into:
 * {Object}   result
 * {Object}   result.template  The parsed template that was validated
 * {Object[]} result.errors    An array of objects related to validating
 *                             the given template
 */
async function parseTemplate(yamlString) {
    let configToValidate;

    try {
        configToValidate = await loadTemplate(yamlString);
        const templateConfiguration = await validateTemplate(configToValidate);

        return {
            errors: [],
            template: templateConfiguration
        };
    } catch (err) {
        if (!err.details) {
            throw err;
        }

        return {
            errors: err.details,
            template: configToValidate
        };
    }
}

module.exports = parseTemplate;
