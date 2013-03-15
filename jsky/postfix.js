(function() {
    var lookahead = '';

    function isDigit(num) {
        return !isNaN(Number(num));
    }

    function Parser(input) {
        this.input = input;
        this.inputLength = input.length;
        this.inputPosition = 0;

        lookahead = this.read();
    }

    Parser.prototype = {
        constructor: Parser,

        read: function() {
            var pos = this.inputPosition, ret;

            if (pos < this.inputLength) {
                // handle the space char
                while (' ' === (ret = this.input.charAt(pos++))) { }
                this.inputPosition = pos;
            } else {
                ret = null;
            }

            return ret;
        },

        expr: function() {
            this.term();

            while (1) {
                if (lookahead === '+') {
                    this.match('+');
                    this.term();

                    console.log('+');
                } else if (lookahead === '-') {
                    this.match('-');
                    this.term();

                    console.log('-');
                } else {
                    return;
                }
            }
        },

        term: function() {
            if (isDigit(lookahead)) {
                console.log(lookahead);
                this.match(lookahead);
            } else {
                throw Error('syntax error')
            }
        },

        match: function(t) {
            if (lookahead === t) {
                lookahead = this.read();
            } else {
                throw Error('syntax error');
            }
        }
    };

    var parser = new Parser('9 - 5 + 2');
    parser.expr();
    
})();