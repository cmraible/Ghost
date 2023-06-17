const jsdom = require('jsdom');
const fs = require('fs');
const path = require('path');
let beautify = require('js-beautify').html;

const {JSDOM} = jsdom;

const assertHTML = async function (
    postId,
    mobiledocHtml,
    lexicalHtml,
    mobiledoc,
    lexical,
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
    const mobiledocPrettifiedHtml = await prettifyHTML(mobiledocHtml.replace(/\n/gm, ''), {
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
    const lexicalPrettifiedHtml = await prettifyHTML(lexicalHtml.replace(/\n/gm, ''), {
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
    if (mobiledocPrettifiedHtml === lexicalPrettifiedHtml) {
        console.log('Post ID: ' + postId + ': ✅');
        return true;
    } else {
        console.log('Post ID: ' + postId + ': ❌');
        fs.mkdirSync(path.join(__dirname, 'results', postId), {recursive: true});
        const mobiledocHtmlPath = path.join(__dirname, 'results', postId, 'mobiledoc.html');
        const lexicalHtmlPath = path.join(__dirname, 'results', postId, 'lexical.html');
        const lexicalPath = path.join(__dirname, 'results', postId, 'lexical.json');
        const mobiledocPath = path.join(__dirname, 'results', postId, 'mobiledoc.json');
        fs.writeFileSync(mobiledocHtmlPath, mobiledocPrettifiedHtml, {flag: 'w+'});
        fs.writeFileSync(lexicalHtmlPath, lexicalPrettifiedHtml, {flag: 'w+'});
        fs.writeFileSync(lexicalPath, JSON.stringify(JSON.parse(lexical), null, 2), {flag: 'w+'});
        fs.writeFileSync(mobiledocPath, JSON.stringify(JSON.parse(mobiledoc), null, 2), {flag: 'w+'});
        return false;
    }
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
    //         htmlWhitespaceSensitivity: 'strict',
    //         singleAttributePerLine: true,
    //         parser: 'html'
    //     })
    //     .trim();

    return beautify(output);
};

module.exports = {assertHTML};
