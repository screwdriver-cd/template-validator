'use strict';

const Hoek = require('@hapi/hoek');

/**
 * Convert job steps from array to object for faster lookup
 * @method convertFromArrayToObject
 * @param  {Array} steps Job step array of objects
 * @return {Object}      Object with: job object, array of lockedStepNames
 */
function convertFromArrayToObject(steps) {
    const lockedStepNames = [];

    if (!steps || steps.length === 0) {
        return { stepObj: {}, lockedStepNames };
    }

    const stepObj = steps.reduce((obj, item) => {
        const key = Object.keys(item)[0];
        const substepKeys = typeof item[key] === 'object' ? Object.keys(item[key]) : undefined;

        // Compress step if only has command key
        if (substepKeys && substepKeys.length === 1) {
            obj[key] = item[key].command;
        } else {
            if (substepKeys && substepKeys.includes('locked')) {
                lockedStepNames.push(key);
            }
            obj[key] = item[key];
        }

        return obj;
    }, {});

    return { stepObj, lockedStepNames };
}
/**
 * Merge oldJob into newJob
 * "oldJob" takes precedence over "newJob". For ex: child template job settings > parent template job settings
 * @param  {Object}   newJob        Job to be merged into. For ex: parent template
 * @param  {Object}   oldJob        Job to merge. For ex: child template
 * @param  {Boolean}  fromTemplate  Whether this is merged from template. If true, perform extra actions such as wrapping.
 */
function merge(newJob, oldJob, fromTemplate) {
    let warnings = [];

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

    // Merge template params
    const newParams = newJob.parameters || {};
    const oldParams = oldJob.parameters || {};

    // Remove duplicate
    newJob.secrets = [...new Set([...newSecrets, ...oldSecrets])];
    newJob.sourcePaths = [...new Set([...newsourcePaths, ...oldsourcePaths])];
    if (!Hoek.deepEqual(newParams, {}) || !Hoek.deepEqual(oldParams, {})) {
        newJob.parameters = { ...newParams, ...oldParams };
    }

    // Use "order" to get steps, ignore all other steps;
    // current template has precedence over external template
    if (fromTemplate && oldJob.order) {
        let stepName;
        const mergedSteps = [];
        const teardownSteps = [];

        // Convert steps from array to object for faster lookup
        const { stepObj: oldSteps } = convertFromArrayToObject(oldJob.steps);
        const { stepObj: newSteps, lockedStepNames } = convertFromArrayToObject(newJob.steps);

        // Order must contain locked steps
        const orderContainsLockedSteps = lockedStepNames.every(v => oldJob.order.includes(v));

        if (!orderContainsLockedSteps) {
            // eslint-disable-next-line max-len
            throw new Error(`Order must contain template ${oldJob.template} locked steps: ${lockedStepNames}`);
        }

        for (let i = 0; i < oldJob.order.length; i += 1) {
            let step;

            stepName = oldJob.order[i];

            const stepLocked = Hoek.reach(newSteps[stepName], 'locked');

            if (!stepLocked && Hoek.reach(oldSteps, stepName)) {
                step = { [stepName]: oldSteps[stepName] };
            } else if (stepLocked || Hoek.reach(newSteps, stepName)) {
                step = { [stepName]: newSteps[stepName] };
                if (stepLocked && Hoek.reach(oldSteps, stepName)) {
                    // eslint-disable-next-line max-len
                    warnings = warnings.concat(
                        `Cannot override locked step ${stepName}; using step definition from template ${oldJob.template}`
                    );
                }
            } else {
                warnings = warnings.concat(`${stepName} step definition not found; skipping`);
            }

            if (step) {
                if (stepName.startsWith('teardown-')) {
                    teardownSteps.push(step);
                } else {
                    mergedSteps.push(step);
                }
            }
        }

        newJob.steps = mergedSteps.concat(teardownSteps);
        // Basic step merge with template
    } else if (fromTemplate && oldJob.steps) {
        let stepName;
        let preStepName;
        let postStepName;
        const mergedSteps = [];
        const teardownSteps = [];

        // Convert steps from oldJob from array to object for faster lookup
        const oldSteps = oldJob.steps.reduce((obj, item) => {
            const key = Object.keys(item)[0];
            const substepKeys = typeof item[key] === 'object' ? Object.keys(item[key]) : undefined;

            if (key.startsWith('teardown-')) {
                teardownSteps.push(key);
            }

            // Compress step if only has command key
            if (substepKeys && substepKeys.length === 1) {
                obj[key] = item[key].command;
            } else {
                obj[key] = item[key];
            }

            return obj;
        }, {});

        for (let i = 0; i < newJob.steps.length; i += 1) {
            [stepName] = Object.keys(newJob.steps[i]);
            preStepName = `pre${stepName}`;
            postStepName = `post${stepName}`;

            // Add pre-step
            if (oldSteps[preStepName]) {
                mergedSteps.push({ [preStepName]: oldSteps[preStepName] });
            }

            const stepLocked = Hoek.reach(newJob.steps[i][stepName], 'locked');

            // If template step is locked or user doesn't define the same step, add it
            if (stepLocked || !oldSteps[stepName]) {
                mergedSteps.push(newJob.steps[i]);
                if (stepLocked && oldSteps[stepName]) {
                    // eslint-disable-next-line max-len
                    warnings = warnings.concat(
                        `Cannot override locked step ${stepName}; using step definition from template ${oldJob.template}`
                    );
                }
            } else if (!stepName.startsWith('teardown-')) {
                // If user defines the same step, only add if it's not teardown and not locked
                // otherwise, skip (it will be overwritten later, otherwise will get duplicate steps)
                mergedSteps.push({ [stepName]: oldSteps[stepName] });
            }

            // Add post-step
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

    return warnings;
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

    // Try to get the parent template
    return templateFactory.getTemplate(oldJob.template).then(template => {
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

        const warnings = merge(newJob, oldJob, true);

        delete newJob.template;

        newJob.templateId = template.id;

        return {
            childJobConfig: newJob,
            parentTemplateImages: template.images,
            warnings
        };
    });
}

module.exports = {
    merge,
    mergeTemplateIntoJob
};
