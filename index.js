'use strict';

const SCHEMA_CONFIG = require('screwdriver-data-schema').config.template.template;
const Yaml = require('js-yaml');
const helper = require('./lib/helper.js');

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
 * If template is specified, merge into job config
 * @method flattenTemplate
 * @param  {Object} templateObj Template config after validation
 * @param  {TemplateFactory}  templateFactory   Template Factory to get template from
 * @return {Promise}            Resolves to new job object after merging template
 */
async function flattenTemplate(templateObj, templateFactory) {
    // If template is specified, then merge
    if (templateObj.config.template && templateFactory) {
        const { childJobConfig, parentTemplateImages } = await helper.mergeTemplateIntoJob(
            templateObj, templateFactory
        );

        templateObj.config = childJobConfig;

        // Merge images object; maintainer, version, description, and
        // template name will not be merged
        if (typeof parentTemplateImages !== 'undefined') {
            templateObj.images = templateObj.images ?
                Object.assign(parentTemplateImages, templateObj.images || {}) :
                parentTemplateImages;
        }
    }

    return templateObj;
}

/**
 * Parses the configuration from a screwdriver-template.yaml
 * @method parseTemplate
 * @param  {String}             yamlString      Contents of screwdriver-template.yaml
 * @param  {TemplateFactory}    templateFactory Template Factory to get template from
 * @return {Promise}            Promise that rejects if the configuration cannot be parsed
 *                              The promise will eventually resolve into:
 * {Object}   result
 * {Object}   result.template  The parsed template that was validated
 * {Object[]} result.errors    An array of objects related to validating
 *                             the given template
 */
async function parseTemplate(yamlString, templateFactory) {
    let configToValidate;

    try {
        configToValidate = await loadTemplate(yamlString);
        const validatedConfig = await validateTemplate(configToValidate);
        // Retrieve template and merge into job config
        const flattenedConfig = await flattenTemplate(
            validatedConfig, templateFactory);

        return {
            errors: [],
            template: flattenedConfig
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
