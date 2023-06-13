const jsdom = require('jsdom');
const prettier = require('prettier');
const {expect} = require('@playwright/test');
const mysql = require('mysql');

const {JSDOM} = jsdom;

const assertHTML = async function (
    mobiledocHtml,
    lexicalHtml,
    {
        ignoreClasses = false,
        ignoreInlineStyles = false,
        ignoreInnerSVG = false,
        getBase64FileFormat = false,
        ignoreCardContents = false,
        ignoreCardToolbarContents = false,
        ignoreDragDropAttrs = false,
        ignoreDataTestId = false,
        ignoreCardCaptionContents = false
    } = {}
) {
    const actual = prettifyHTML(mobiledocHtml.replace(/\n/gm, ''), {
        ignoreClasses,
        ignoreInlineStyles,
        ignoreInnerSVG,
        getBase64FileFormat,
        ignoreCardContents,
        ignoreCardToolbarContents,
        ignoreDragDropAttrs,
        ignoreDataTestId,
        ignoreCardCaptionContents
    });
    const expected = prettifyHTML(lexicalHtml.replace(/\n/gm, ''), {
        ignoreClasses,
        ignoreInlineStyles,
        ignoreInnerSVG,
        getBase64FileFormat,
        ignoreCardContents,
        ignoreCardToolbarContents,
        ignoreDragDropAttrs,
        ignoreDataTestId,
        ignoreCardCaptionContents
    });
    expect(actual).toEqual(expected);
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

    return prettier
        .format(output, {
            attributeGroups: ['$DEFAULT', '^data-'],
            attributeSort: 'ASC',
            bracketSameLine: true,
            htmlWhitespaceSensitivity: 'ignore',
            parser: 'html'
        })
        .trim();
};

const getPosts = async function () {
    const posts = [];
    const connection = mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: 'password',
        database: 'thelever'
    });
    
    connection.connect(function (err) {
        if (err) {
            console.error('error connecting: ' + err.stack);
            return;
        }
      
        console.log('connected as id ' + connection.threadId);
    });
    
    connection.query('SELECT mobiledoc FROM posts;', function (error, results, fields) {
        if (error) {
            throw error;
        }
    
        for (let i = 0; i < results.length; i++) {
            posts.push(results[i].mobiledoc);
        }
    });

    connection.end();

    return posts;
};

module.exports = {assertHTML, getPosts};
