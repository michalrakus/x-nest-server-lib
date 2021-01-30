function generateApi(cb) {

    // const file = require('gulp-file');
    // const {dest} = require('gulp');

    // return file('XLazyDataTable.d.ts', "export * from './lib/components/XLazyDataTable';", {src: true})
    //     .pipe(file('XLazyDataTable.js', "'use strict';\n\nmodule.exports = require('./lib/components/XLazyDataTable.js');"))
    //     .pipe(dest('.'));

    // TODO - vymazat subory *.d.ts a *.js (okrem gulpfile.js)

    // toto sa mi zda jednoduchsie
    const fs = require('fs');

    const apiFileList = [
        "./lib/administration/xuser.entity",
        //"./lib/services/x-entity-metadata.service",
        //"./lib/services/x-lazy-data-table.service",
        //"./lib/services/x-lib.service",
        //"./lib/services/x-lib.controller",
        "./lib/services/x-lib.module"
    ];

    for (const apiFile of apiFileList) {
        const posSlash = apiFile.lastIndexOf('/');
        let fileName;
        if (posSlash !== -1) {
            fileName = apiFile.substring(posSlash + 1);
        }
        else {
            fileName = apiFile;
        }
        fs.writeFileSync(`${fileName}.d.ts`, `// generated by gulp\n\nexport * from '${apiFile}';`);
        fs.writeFileSync(`${fileName}.js`, `// generated by gulp\n\n'use strict';\n\nmodule.exports = require('${apiFile}.js');`);
    }

    cb();
}

exports.generateApi = generateApi;