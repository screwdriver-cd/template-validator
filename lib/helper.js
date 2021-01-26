'use strict';

const Hoek = require('@hapi/hoek');

/**
 * Merge oldJob into newJob
 * "oldJob" takes precedence over "newJob". For ex: child template job settings > parent template job settings
 * @param  {Object}   newJob        Job to be merged into. For ex: parent template
 * @param  {Object}   oldJob        Job to merge. For ex: child template
 * @param  {Boolean}  fromTemplate  Whether this is merged from template. If true, perform extra actions such as wrapping.
 */
function merge(newJob, oldJob, fromTemplate) {
    // Intialize new job with default fields (environment, settings, and secrets)
    newJob.annotations = newJob.annotations || {};
    newJob.environment = newJob.environment || {};
    newJob.settings = newJob.settings || {};

    // Merge
    Object.assign(newJob.annotations, oldJob.annotations || {});
    Object.assign(newJob.environment, oldJob.environment || {});
    Object.assign(newJob.settings, oldJob.settings || {});
    newJob.image = oldJob.image || newJob.image;

    if (oldJob.requires) {
        newJob.requires = [].concat(oldJob.requires);
    } // otherwise, keep it the same, or don't set if it wasn't set

    if (oldJob.blockedBy) {
        newJob.blockedBy = [].concat(oldJob.blockedBy);
    }

    if (oldJob.freezeWindows) {
        newJob.freezeWindows = [].concat(oldJob.freezeWindows);
    }

    if (oldJob.cache || oldJob.cache === false) {
        newJob.cache = oldJob.cache;
    }

    // Merge secrets
    const newSecrets = newJob.secrets || [];
    const oldSecrets = oldJob.secrets || [];

    // Merge sourcePaths
    let newsourcePaths = newJob.sourcePaths || [];
    let oldsourcePaths = oldJob.sourcePaths || [];

    newsourcePaths = Array.isArray(newsourcePaths) ? newsourcePaths : [newsourcePaths];
    oldsourcePaths = Array.isArray(oldsourcePaths) ? oldsourcePaths : [oldsourcePaths];

    // remove duplicate
    newJob.secrets = [...new Set([...newSecrets, ...oldSecrets])];
    newJob.sourcePaths = [...new Set([...newsourcePaths, ...oldsourcePaths])];

    if (fromTemplate && oldJob.steps) {
        let stepName;
        let preStepName;
        let postStepName;
        const mergedSteps = [];
        const teardownSteps = [];

        // convert steps from oldJob from array to object for faster lookup
        const oldSteps = oldJob.steps.reduce((obj, item) => {
            const key = Object.keys(item)[0];

            if (key.startsWith('teardown-')) {
                teardownSteps.push(key);
            }

            obj[key] = item[key];

            return obj;
        }, {});

        for (let i = 0; i < newJob.steps.length; i += 1) {
            [stepName] = Object.keys(newJob.steps[i]);
            preStepName = `pre${stepName}`;
            postStepName = `post${stepName}`;

            // add pre-step
            if (oldSteps[preStepName]) {
                mergedSteps.push({ [preStepName]: oldSteps[preStepName] });
            }

            // if user doesn't define the same step, add it
            if (!oldSteps[stepName]) {
                mergedSteps.push(newJob.steps[i]);
            } else if (!stepName.startsWith('teardown-')) {
                // if user defines the same step, only add if it's not teardown
                // otherwise, skip (it will be overriden later, otherwise will get duplicate steps)
                mergedSteps.push({ [stepName]: oldSteps[stepName] });
            }

            // add post-step
            if (oldSteps[postStepName]) {
                mergedSteps.push({ [postStepName]: oldSteps[postStepName] });
            }
        }

        for (let i = 0; i < teardownSteps.length; i += 1) {
            stepName = teardownSteps[i];
            mergedSteps.push({ [stepName]: oldSteps[stepName] });
        }

        newJob.steps = mergedSteps;
    }
}

/**
 * Retrieve template and merge into job config
 * @method mergeTemplateIntoJob
 * @param  {Object}           templateObj       Template object with job config
 * @param  {TemplateFactory}  templateFactory   Template Factory to get template from
 * @return {Promise}                            Resolves with obj with:
 *                                              - new flattened job config
 *                                              - parent template images object
 */
async function mergeTemplateIntoJob(templateObj, templateFactory) {
    // Child template config
    const oldJob = templateObj.config;

    // Try to get the template
    return templateFactory.getTemplate(oldJob.template)
        .then((template) => {
            if (!template) {
                throw new Error(`Template ${oldJob.template} does not exist`);
            }

            // Parent template config
            const newJob = template.config;
            const environment = newJob.environment || {};

            // Construct full template name
            let fullName = template.name;

            if (template.namespace && template.namespace !== 'default') {
                fullName = `${template.namespace}/${template.name}`;
            }

            // Inject template full name, name, namespace, and version to env
            newJob.environment = Hoek.merge(environment, {
                SD_TEMPLATE_FULLNAME: fullName,
                SD_TEMPLATE_NAME: template.name,
                SD_TEMPLATE_NAMESPACE: template.namespace || '',
                SD_TEMPLATE_VERSION: template.version
            });

            merge(newJob, oldJob, true);
            delete newJob.template;

            newJob.templateId = template.id;

            // If template.images contains a label match for the image defined in the job
            // set the job image to the respective template image
            if (typeof template.images !== 'undefined'
                && typeof template.images[newJob.image] !== 'undefined') {
                newJob.image = template.images[newJob.image];
            }

            return {
                childJobConfig: newJob,
                parentTemplateImages: template.images
            };
        });
}

module.exports = {
    merge,
    mergeTemplateIntoJob
};
