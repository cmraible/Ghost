const jsdom = require('jsdom');
let beautify = require('js-beautify').html;
const prettier = require('prettier');
const util = require('util');
const mysql = require('mysql');
const {decode} = require('html-entities');

const {JSDOM} = jsdom;

const makeDb = function () {
    const config = {
        host: '127.0.0.1',
        user: 'root',
        password: 'password',
        database: 'migrationTest',
        charset: 'utf8mb4'
    };
    const connection = mysql.createConnection(config);
    
    return {
        query(sql, args) {
            return util.promisify(connection.query).call(connection, sql, args);
        },
        close() {
            return util.promisify(connection.end).call(connection);
        }
    };
};

const prettifyHTML = async function (string, options = {}) {
    let output = string;

    if (options.ignoreClasses) {
        output = output.replace(/\sclass="([^"]*)"/g, '');
    }

    if (options.ignoreDataTestId) {
        output = output.replace(/\sdata-testid="([^"]*)"/g, '');
    }

    if (options.ignoreInlineStyles) {
        output = output.replace(/\sstyle="([^"]*)"/g, '');
    }
    if (options.ignoreInnerSVG) {
        output = output.replace(/<svg[^>]*>.*?<\/svg>/g, '<svg></svg>');
    }

    if (options.getBase64FileFormat) {
        output = output.replace(/(^|[\s">])data:([^;]*);([^"]*),([^"]*)/g, '$1data:$2;$3,BASE64DATA');
    }

    if (options.ignoreDragDropAttrs) {
        output = output.replace(/data-koenig-dnd-.*?=".*?"/g, '');
    }

    // replace all instances of blob:http with "blob:..."
    output = output.replace(/blob:http[^"]*/g, 'blob:...');

    // replace opening and closing tags with self closing tags
    output = output.replace(/><\/path>/g, '/>');
    output = output.replace(/><\/rect>/g, '/>');
    output = output.replace(/><\/polyline>/g, '/>');
    output = output.replace(/><\/line>/g, '/>');
    output = output.replace(/><\/circle>/g, '/>');

    // replace duplicate <em> tags with single <em> tag
    output = output.replace(/<em><em>/g, '<em>');
    output = output.replace(/<\/em><\/em>/g, '</em>');

    // replace duplicate <string> tags with single <strong> tag
    output = output.replace(/<strong><strong>/g, '<strong>');
    output = output.replace(/<\/strong><\/strong>/g, '</strong>');

    // replace empty attribute values with booleans
    output = output.replace(/=""/g, '');

    // replace b with strong
    output = output.replace(/<b>/g, '<strong>');
    output = output.replace(/<\/b>/g, '</strong>');

    // replace i with em
    output = output.replace(/<i>/g, '<em>');
    output = output.replace(/<\/i>/g, '</em>');

    // remove spaces between brackets
    output = output.replace(/>\s+</g, '><');

    // replace entities with unicode
    output = decode(output);

    if (options.ignoreCardContents || options.ignoreCardToolbarContents || options.ignoreCardCaptionContents) {
        const {document} = (new JSDOM(output)).window;

        const querySelectors = [];
        if (options.ignoreCardContents) {
            querySelectors.push('[data-kg-card]');
        }
        if (options.ignoreCardToolbarContents) {
            querySelectors.push('[data-kg-card-toolbar]');
        }
        if (options.ignoreCardCaptionContents) {
            querySelectors.push('figcaption');
        }

        document.querySelectorAll(querySelectors.join(', ')).forEach((element) => {
            element.innerHTML = '';
        });
        output = document.body.innerHTML;
    }
    
    // const prettierFormatted = prettier
    //     .format(output, {
    //         attributeGroups: ['$DEFAULT', '^data-'],
    //         attributeSort: 'ASC',
    //         bracketSameLine: true,
    //         // htmlWhitespaceSensitivity: 'strict',
    //         singleAttributePerLine: true,
    //         parser: 'html'
    //     })
    //     .trim();

    return beautify(output);
};

module.exports = {prettifyHTML, makeDb};
