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
 * @method validateTemplateStructure
 * @param  {Object}         templateObj Configuration object that represents the template
 * @return {Promise}                    Promise that resolves to the passed-in config object
 */
async function validateTemplateStructure(templateObj) {
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
 * Check that "order" is only used with "template"
 * Deletes "order" field if "template" not defined
 * @method validateOrderAndTemplate
 * @param  {Object}           config            Template job config
 * @return {Array}                              List of warnings
 */
function validateOrderAndTemplate(config) {
    let warnings = [];

    const order = config.config.order || [];
    const template = config.config.template;

    if (order.length > 0 && template === undefined) {
        warnings = warnings.concat(
            '"order" in template config cannot be used without "template"'
        );
        delete config.config.order;
    }

    return warnings;
}

/**
 * If template is specified, merge into job config
 * @method flattenTemplate
 * @param  {Object}             templateObj         Template config after validation
 * @param  {TemplateFactory}    templateFactory     Template Factory to get template from
 * @return {Promise}            Resolves to new job object after merging template, warn messages
 */
async function flattenTemplate(templateObj, templateFactory) {
    let warnMessages = [];

    // If template is specified, then merge
    if (templateObj.config.template && templateFactory) {
        const { childJobConfig, parentTemplateImages, warnings } =
            await helper.mergeTemplateIntoJob(templateObj, templateFactory);

        warnMessages = warnings;
        templateObj.config = childJobConfig;

        // Merge images object
        if (typeof parentTemplateImages !== 'undefined') {
            templateObj.images = templateObj.images ?
                Object.assign(parentTemplateImages, templateObj.images || {}) :
                parentTemplateImages;
        }

        // If template.images contains a label match for the image defined in the job
        // set the job image to the respective template image
        if (typeof templateObj.images !== 'undefined'
            && typeof templateObj.images[childJobConfig.image] !== 'undefined') {
            childJobConfig.image = templateObj.images[childJobConfig.image];
        }
    }

    return { flattenedConfig: templateObj, warnMessages };
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
        const config = await validateTemplateStructure(configToValidate);
        let warnMessages = [].concat(validateOrderAndTemplate(config));

        // Retrieve template and merge into job config
        const { flattenedConfig, warnMessages: flattenWarnings } = await flattenTemplate(
            config, templateFactory);
        const res = {
            errors: [],
            template: flattenedConfig
        };

        warnMessages = warnMessages.concat(flattenWarnings);

        if (warnMessages.length > 0) {
            res.warnMessages = warnMessages;
        }

        return res;
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
