# Template Validator
[![Version][npm-image]][npm-url] ![Downloads][downloads-image] [![Build Status][status-image]][status-url] [![Open Issues][issues-image]][issues-url] [![Dependency Status][daviddm-image]][daviddm-url] ![License][license-image]

> A module for validating a Screwdriver Template file

## yaml

```yaml
# example.yaml
name: tkyi/nodejs_main
version: 2.0.1
description: |
  Template for a NodeJS main job. Installs the NPM module dependencies and executes
  the test target.
maintainer: tiffanykyi@gmail.com
config:
  image: node:4
  steps:
    - install: npm install
    - test: npm test
  environment:
    NODE_ENV: production
  secrets:
     - NPM_TOKEN

```

## Usage


```bash
$ npm install screwdriver-template-validator
```

Validate in Node.js:

```javascript
const fs = require('fs');  // standard fs module
const validator = require('screwdriver-template-validator');

// The "example.yaml" is the YAML described above
validator(fs.readFileSync('example.yaml'))
    .then((templateData) => {
        console.log(templateData);
    });
```

Output of the console.log():

```javascript
{
    "name": "tkyi/nodejs_main",
    "version": "2.0.1",
    "description": "Template for a NodeJS main ...",  //truncated for brevity
    "maintainer": "tiffanykyi@gmail.com",
    "config": {
        "environment": {
            "NODE_ENV": "production"
        },
        "image": "node:4",
        "secrets": [
            "NPM_TOKEN"
        ],
        "steps": [{
            "install": "npm install"
        }, {
            "test": "npm test"
        }]
    }
}
```





## Testing

```bash
npm test
```

## License

Code licensed under the BSD 3-Clause license. See LICENSE file for terms.

[npm-image]: https://img.shields.io/npm/v/screwdriver-template-validator.svg
[npm-url]: https://npmjs.org/package/screwdriver-template-validator
[downloads-image]: https://img.shields.io/npm/dt/screwdriver-template-validator.svg
[license-image]: https://img.shields.io/npm/l/screwdriver-template-validator.svg
[issues-image]: https://img.shields.io/github/issues/screwdriver-cd/template-validator.svg
[issues-url]: https://github.com/screwdriver-cd/template-validator/issues
[status-image]: https://cd.screwdriver.cd/pipelines/88/badge
[status-url]: https://cd.screwdriver.cd/pipelines/88
[daviddm-image]: https://david-dm.org/screwdriver-cd/template-validator.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/screwdriver-cd/template-validator
