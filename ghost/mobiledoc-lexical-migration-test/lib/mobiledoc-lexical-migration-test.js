// Main module file
const mobiledocLib = require('../../core/core/server/lib/mobiledoc');
const lexicalLib = require('../../core/core/server/lib/lexical');
const mobiledocToLexical = require('@tryghost/kg-converters').mobiledocToLexical;
const {prettifyHTML, makeDb} = require('./utils');
const fs = require('fs');

const db = makeDb();

const testPosts = async () => {
    // const posts = await db.query('SELECT uuid, mobiledoc FROM posts WHERE uuid IN ("4f6498a3-e270-43cc-af05-38488a4cad8c", "a1545e01-1073-423e-b8d6-35acdafa06bd", "4b7c175a-5293-4ac0-9614-026324757da7");');
    const posts = await db.query('SELECT uuid, mobiledoc FROM posts ORDER BY RAND();');
    let successCount = 0;
    let trialCount = 0;
    for (const post of posts) {
        console.log('Post ID: ' + post.uuid + ': ⌛');
        // Get the mobiledoc and render it to HTML
        const mobiledoc = post.mobiledoc;
        if (!mobiledoc || mobiledoc === null || mobiledoc === 'null') {
            continue;
        }
        const mobiledocHtml = mobiledocLib.mobiledocHtmlRenderer.render(JSON.parse(mobiledoc));
        // Convert the mobiledoc to lexical, then render lexical to HTML
        let lexical = {};
        try {
            lexical = mobiledocToLexical(mobiledoc);
            await db.query('UPDATE posts SET lexical = ? WHERE uuid = ?;', [lexical, post.uuid]);
        } catch (error) {
            console.log('🚨 Error converting mobiledoc to lexical: ', error);
        }
        const lexicalHtml = lexicalLib.render(lexical);
        // Prettify the HTML and compare
        const mobiledocPrettifiedHtml = await prettifyHTML(mobiledocHtml.replace(/\n/gm, ''), {
            ignoreClasses: false,
            removeRedundantTags: true,
            ignoreInlineStyles: false,
            ignoreInnerSVG: false,
            getBase64FileFormat: false,
            ignoreCardContents: false,
            ignoreCardToolbarContents: false,
            ignoreDragDropAttrs: false,
            ignoreDataTestId: false,
            ignoreCardCaptionContents: false
        });
        const lexicalPrettifiedHtml = await prettifyHTML(lexicalHtml.replace(/\n/gm, ''), {
            ignoreClasses: false,
            removeRedundantTags: true,
            ignoreInlineStyles: false,
            ignoreInnerSVG: false,
            getBase64FileFormat: false,
            ignoreCardContents: false,
            ignoreCardToolbarContents: false,
            ignoreDragDropAttrs: false,
            ignoreDataTestId: false,
            ignoreCardCaptionContents: false
        });
        if (mobiledocPrettifiedHtml === lexicalPrettifiedHtml) {
            const result = await db.query('UPDATE posts SET lexicalHtml = ?, mobiledocHtml = ?, result = 1 WHERE uuid = ?;', [lexicalPrettifiedHtml, mobiledocPrettifiedHtml, post.uuid]);
            successCount++;
            console.log('Post ID: ' + post.uuid + ': ✅');
        } else {
            const result = await db.query('UPDATE posts SET lexicalHtml = ?, mobiledocHtml = ?, result = 0 WHERE uuid = ?;', [lexicalPrettifiedHtml, mobiledocPrettifiedHtml, post.uuid]);
            fs.writeFileSync('./results/' + post.uuid + '.lexical.html', lexicalPrettifiedHtml, 'utf8');
            fs.writeFileSync('./results/' + post.uuid + '.lexical.json', JSON.stringify(JSON.parse(lexical), null, 2), 'utf8');
            fs.writeFileSync('./results/' + post.uuid + '.mobiledoc.html', mobiledocPrettifiedHtml, 'utf8');
            fs.writeFileSync('./results/' + post.uuid + '.mobiledoc.json', JSON.stringify(JSON.parse(mobiledoc), null, 2), 'utf8');
            console.log('Post ID: ' + post.uuid + ': ❌');
        }
        trialCount++;
        console.log('Success Rate: ' + successCount + '/' + trialCount + ' (' + (successCount / trialCount * 100).toFixed(2) + '%)');
    }
    db.close();
};

testPosts();
