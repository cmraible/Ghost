// Main module file
const mobiledocLib = require('../../core/core/server/lib/mobiledoc');
const lexicalLib = require('../../core/core/server/lib/lexical');
const mobiledocToLexical = require('@tryghost/kg-converters').mobiledocToLexical;
const {assertHTML} = require('./utils');
const fs = require('fs');
const path = require('path');
const posts = require('./data/posts.json');

console.log(typeof posts);

// Clear out past results and recreate the results directory
const resultsPath = path.join(__dirname, 'results');
if (fs.existsSync(resultsPath)) {
    fs.rmSync(resultsPath, {recursive: true});
}
if (!fs.existsSync(resultsPath)) {
    fs.mkdirSync(resultsPath, {recursive: true});
}

const testPosts = async function () {
    let failures = 0;
    for (const post in posts) {
        console.log(post);
        console.log('Comparing post ' + post.uuid);
        const mobiledoc = post.mobiledoc;
        const mobiledocHtml = renderMobiledocToHtml(mobiledoc);
        const lexicalHtml = renderConvertedMobiledocToHtml(mobiledoc);
        if (lexicalHtml !== undefined) {
            const result = await assertHTML(post.uuid, mobiledocHtml, lexicalHtml);
            if (!result) {
                failures += 1;
            }
        }
    }
    console.log('Total Posts: ' + results.length);
    console.log('Failures: ' + failures);
    console.log('Success Rate: ' + (results.length - failures) / results.length);
};

testPosts();

const renderMobiledocToHtml = function (mobiledoc) {
    return mobiledocLib.mobiledocHtmlRenderer.render(JSON.parse(mobiledoc));
};

const renderConvertedMobiledocToHtml = function (mobiledoc) {
    try {
        const lexical = mobiledocToLexical(mobiledoc);
        if (lexical) {
            return lexicalLib.render(lexical);
        }
        return undefined;
    } catch (err) {
        console.log('🚨 Error converting mobiledoc to lexical: ', err);
    }
};

const compareRenderedHtml = function (mobiledoc) {
    const mobiledocHtml = renderMobiledocToHtml(mobiledoc);
    const lexicalHtml = renderConvertedMobiledocToHtml(mobiledoc);
    if (lexicalHtml) {
        return assertHTML(mobiledocHtml, lexicalHtml);
    }
};

module.exports = {
    renderMobiledocToHtml,
    renderConvertedMobiledocToHtml,
    compareRenderedHtml
};