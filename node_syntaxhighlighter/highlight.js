var fs = require('fs'),
    util = require('util'),
    htmlparser = require('htmlparser'),

    sh = require('./libs/shCore');

var brushes_path = './libs/brushes/';
var brushes = fs.readdirSync(brushes_path);

// load all brushes
brushes.forEach(function(brush) {
    if (/\.(js|node)$/.test(brush)) {
        require(brushes_path + brush);
    }
});

var DOM = htmlparser.DomUtils;

var getAttributes = function(node) {
    var text = [], attrs, attr;
    if (attrs = node.attribs) {
        for (attr in attrs) {
            if (attrs.hasOwnProperty(attr)) {
                text.push(attr + '="' + attrs[attr] + '"');
            }
        }
    }

    return text.length > 0 ? ' ' + text.join(' ') : '';
};

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
                html.push('<' + node.raw + '>');
                break;
            case 'comment':
                html.push('<!--' + node.raw + '-->');
                break;
            default:
                html.push('<' + node.name + getAttributes(node) + '>');
                if (node.children) {
                    html = html.concat(toHtml(node.children, true, checkList));
                }
                html.push('</' + node.name + '>');
                break;
        }
    });

    if (!asArray) {
        html = html.join('');
    }

    return html;
};

var handler = new htmlparser.DefaultHandler(function(error, dom) {
    if (error) {
        console.log(error);
    } else {
        console.log('Parse succeed!');
    }
});

var highlight = function(html) {
    var parser = new htmlparser.Parser(handler),
        elements;

    parser.parseComplete(html);

    elements = sh.SyntaxHighlighter.highlight(handler.dom) || [];
    elements = elements.map(function(element) {
        return element.target;
    });

    return toHtml(handler.dom, false, {
        list: elements,
        callback: function(node) {
            return '<div>' + node.wrapper.html + '</div>';
        }
    });
};

exports.highlight = highlight;
