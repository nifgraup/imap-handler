// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function(root, factory) {
    "use strict";

    if (typeof define === "function" && define.amd) {
        define(["imap-formal-syntax"], factory);
    } else if (typeof exports === "object") {
        module.exports = factory(require("./imap-formal-syntax"));
    } else {
        root.imapCompiler = factory(root.imapFormalSyntax);
    }
}(this, function(imapFormalSyntax) {

    "use strict";

    var utf8Encode = function(chars) {
        var ascii = "";
        for(var i = 0; i < chars.length; i++) {
            var c = chars[i].charCodeAt(0);
            if (c <= 0x7f) {
                ascii += chars[i];
            } else {
                var h = encodeURIComponent(chars[i]).substr(1).split('%');
                for (var j = 0; j < h.length; j++) {
                    ascii += String.fromCharCode(parseInt(h[j], 16));
                }
            }
        }
        return ascii;
    };

    /**
     * Compiles an input object into
     */
    return function(response, asArray) {
        var respParts = [],
            resp = (response.tag || "") + (response.command ? " " + response.command : ""),
            val, lastType,
            walk = function(node) {

                if (lastType === "LITERAL" || (["(", "<", "["].indexOf(resp.substr(-1)) < 0 && resp.length)) {
                    resp += " ";
                }

                if (Array.isArray(node)) {
                    lastType = "LIST";
                    resp += "(";
                    node.forEach(walk);
                    resp += ")";
                    return;
                }

                if (!node && typeof node !== "string" && typeof node !== "number") {
                    resp += "NIL";
                    return;
                }

                if (typeof node === "string") {
                    resp += JSON.stringify(node);
                    return;
                }

                if (typeof node === "number") {
                    resp += Math.round(node) || 0; // Only integers allowed
                    return;
                }

                lastType = node.type;
                switch (node.type.toUpperCase()) {
                    case "LITERAL":
                        var s = "";
                        if (!node.value) {
                            resp += "{0}\r\n";
                        } else {
                            s = utf8Encode(node.value);
                            resp += "{" + s.length + "}\r\n";
                        }
                        respParts.push(resp);
                        resp = s;
                        break;

                    case "STRING":
                        resp += JSON.stringify(utf8Encode(node.value) || "");
                        break;

                    case "TEXT":
                    case "SEQUENCE":
                        resp += node.value || "";
                        break;

                    case "NUMBER":
                        resp += (node.value || 0);
                        break;

                    case "ATOM":
                    case "SECTION":
                        val = node.value || "";

                        if (imapFormalSyntax.verify(val.charAt(0) === "\\" ? val.substr(1) : val, imapFormalSyntax["ATOM-CHAR"]()) >= 0) {
                            val = JSON.stringify(val);
                        }

                        resp += val;

                        if (node.section) {
                            resp += "[";
                            node.section.forEach(walk);
                            resp += "]";
                        }
                        if (node.partial) {
                            resp += "<" + node.partial.join(".") + ">";
                        }
                        break;
                }

            };

        [].concat(response.attributes || []).forEach(walk);

        if (resp.length) {
            respParts.push(resp);
        }

        return asArray ? respParts : respParts.join("");
    };
}));
