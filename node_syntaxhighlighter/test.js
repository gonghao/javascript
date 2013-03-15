var htmlparser = require('htmlparser');
var DOM = htmlparser.DomUtils;
var fs = require('fs');
var util = require('util');
var rawHtml = fs.readFileSync('test.html', 'utf8');

var sh = require('./libs/shCore');
var brushes_path = './libs/brushes/';
var brushes = fs.readdirSync(brushes_path);

// load all brushes
brushes.forEach(function(brush) {
    if (/\.(js|node)$/.test(brush)) {
        require(brushes_path + brush);
    }
});

var toHtml = function(nodeList, asArray, checkList) {
    var html = [];

    if (!util.isArray(nodeList)) {
        nodeList = [ nodeList ];
    }

    nodeList.forEach(function(node) {
        if (checkList && checkList.list && checkList.callback) {
            if (checkList.list.indexOf(node) > -1) {
                html.push(checkList.callback(node));
                return;
            }
        }

        switch (node.type) {
            case 'text':
                html.push(node.raw);
                break;
            case 'directive':
                html.push('<!' + node.raw + '>');
                break;
            case 'commet':
                html.push('<!--' + node.raw + '>');
                break;
            default:
                html.push('<' + node.name + '>');
                if (node.children) {
                    html = html.concat(toHtml(node.children, true, checkList));
                }
                html.push('</' + node.name + '>');
        }
    });

    if (!asArray) {
        html = html.join('');
    }

    return html;
};

var handler = new htmlparser.DefaultHandler(function(error, dom) {
    var elements;

    if (error) {
        console.log(error);
    } else {
        console.log('parse succeed!');
        tags = DOM.getElementsByTagName('pre', dom);
        tags.forEach(function(tag) {
            //console.log(tag);
        });
        elements = sh.SyntaxHighlighter.highlight(dom);
        elements = elements.map(function(element) {
            return element.target;
        });

        console.log(toHtml(dom, false, {
            list: elements,
            callback: function(node) {
                return '<div>' + node.wrapper.html + '</div>';
            }
        }));
    }
});

var parser = new htmlparser.Parser(handler);
parser.parseComplete(rawHtml);

