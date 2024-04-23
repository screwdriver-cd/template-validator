'use strict';

const SCHEMA_CONFIG = require('screwdriver-data-schema').config.template.template;
const parser = require('screwdriver-config-parser').parsePipelineTemplate;
const Yaml = require('js-yaml');
const helper = require('./lib/helper');

/**
 * Loads the configuration from a stringified screwdriver-template.yaml
 * @method loadTemplate
 * @param  {String} yamlString Contents of screwdriver-template.yaml
 * @return {Promise}           Promise that resolves to the template as a config object
 */
async function loadTemplate(yamlString) {
    return Yaml.load(yamlString);
}

/**
 * Validate the template configuration
 * @method validateTemplateStructure
 * @param  {Object}         templateObj Configuration object that represents the template
 * @param  {Object}         schema      Dateschema for template validation
 * @return {Promise}                    Promise that resolves to the passed-in config object
 */
async function validateTemplateStructure(templateObj, schema) {
    const data = await schema.validateAsync(templateObj, {
        abortEarly: false
    });

    return data;
}

/**
 * If template is specified, merge into job config
 * @method flattenTemplate
 * @param  {Object}             templateObj         Template config after validation
 * @param  {TemplateFactory}    templateFactory     Template Factory to get template from
 * @return {Promise}            Resolves to new job object after merging template, warn messages
 */
async function flattenTemplate(templateObj, templateFactory) {
    const order = templateObj.config.order || [];
    const { template } = templateObj.config;
    let warnMessages = [];

    // Validate order is used with template
    if (order.length > 0 && template === undefined) {
        warnMessages = warnMessages.concat('"order" in template config cannot be used without "template"');
        delete templateObj.config.order;
    }

    // If template is specified, then merge
    if (template && templateFactory) {
        const { childJobConfig, parentTemplateImages, warnings } = await helper.mergeTemplateIntoJob(
            templateObj,
            templateFactory
        );

        warnMessages = warnMessages.concat(warnings);
        templateObj.config = childJobConfig;

        // Merge images object
        if (typeof parentTemplateImages !== 'undefined') {
            templateObj.images = templateObj.images
                ? Object.assign(parentTemplateImages, templateObj.images || {})
                : parentTemplateImages;
        }

        // If template.images contains a label match for the image defined in the job
        // set the job image to the respective template image
        if (
            typeof templateObj.images !== 'undefined' &&
            typeof templateObj.images[childJobConfig.image] !== 'undefined'
        ) {
            childJobConfig.image = templateObj.images[childJobConfig.image];
        }
    }

    return { flattenedConfig: templateObj, warnMessages };
}

/**
 * Parses the job configuration from a screwdriver-template.yaml
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
async function parseJobTemplate(yamlString, templateFactory) {
    let configToValidate;

    try {
        configToValidate = await loadTemplate(yamlString);
        const config = await validateTemplateStructure(configToValidate, SCHEMA_CONFIG);
        // Retrieve parent template and merge into job config
        const { flattenedConfig, warnMessages } = await flattenTemplate(config, templateFactory);
        const res = {
            errors: [],
            template: flattenedConfig
        };

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

/**
 * Parses the pipeline configuration from a screwdriver-template.yaml
 * @method parsePipelineTemplate
 * @param  {String}             yamlString      Contents of screwdriver-template.yaml
 * @return {Promise}            Promise that rejects if the configuration cannot be parsed
 *                              The promise will eventually resolve into:
 * {Object}   result
 * {Object}   result.template  The parsed template that was validated
 * {Object[]} result.errors    An array of objects related to validating
 *                             the given template
 */
async function parsePipelineTemplate(yamlString) {
    const configToValidate = await loadTemplate(yamlString);

    try {
        const config = await parser({ yaml: yamlString });

        return {
            errors: [],
            template: config
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

module.exports = {
    parseJobTemplate,
    parsePipelineTemplate
};
