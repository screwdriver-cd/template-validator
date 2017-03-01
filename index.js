'use strict';

const Joi = require('joi');
const SCHEMA_CONFIG = require('screwdriver-data-schema').config.template.template;
const Yaml = require('js-yaml');

/**
 * Loads the configuration from a stringified screwdriver-template.yaml
 * @method loadTemplate
 * @param  {String} yamlString Contents of screwdriver-template.yaml
 * @return {Promise}           Promise that resolves to the template as a config object
 */
function loadTemplate(yamlString) {
    return new Promise(resolve =>
        resolve(Yaml.safeLoad(yamlString))
    );
}

/**
 * Validate the template configuration
 * @method validateTemplate
 * @param  {Object}         templateObj Configuration object that represents the template
 * @return {Promise}                    Promise that resolves to the passed-in config object
 */
function validateTemplate(templateObj) {
    return new Promise((resolve, reject) => {
        Joi.validate(templateObj, SCHEMA_CONFIG, {
            abortEarly: false
        }, (err, data) => {
            if (err) {
                return reject(err);
            }

            return resolve(data);
        });
    });
}

/**
 * Parses the configuration from a screwdriver-template.yaml
 * @method parseTemplate
 * @param  {String} yamlString Contents of screwdriver-template.yaml
 * @return {Promise}           Promise that resolves to the template as a config object
 */
function parseTemplate(yamlString) {
    return loadTemplate(yamlString)
    .then(validateTemplate);
}

module.exports = parseTemplate;
