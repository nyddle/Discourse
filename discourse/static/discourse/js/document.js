$(function() {
    $('.discourse-edit .document').each(function(i, element) {
        Document({source: element});
    });
});

Document = Tea.Element.extend({
    type: 'discourse-document',
    storage: null,
    block_types: ["P", "UL", "OL", "BLOCKQUOTE", "H4", "H5", "TABLE"],
    init : function() {
        this.__super__();
        this.editing = false;

        this._src = this.source.children('.src');
        this._html = this.source.children('.html');

        if (!this.storage)
            this.storage = Storage({ document: this,
                                     url: this.source.attr('url'),
                                     attribute: this.source.attr('attribute'),
                                     value: this.getValue() });

        this.hook(this.storage, 'success', function(value) {
            if (!this.editing)
                this.setValue(value);
        })

        this.hook($(document), 'click', this.onDocClick);
        this.hook($(document), 'unload', this.stopEditing);
        this.hook(this.source, 'mouseup', this.onMouseup);
        this.hook(this.source, 'keydown', this.onKeyDown);
        this.hook(this.source, 'input', this.onInput);
        
        if (this.is_empty()) {
            this.source.addClass('discourse-empty');
            this._src.empty();
            this._html.empty();
        } else {
            this.source.removeClass('discourse-empty');
        }
    },
    startEditing : function() {
        Overlay.startEdit(this);
        this.source.attr('contenteditable', true)
                   .addClass('discourse-editing')
                   .removeClass('discourse-empty')
                   .focus();

        this._src.show();
        this._html.hide();

        if (this.is_empty()) {
            this.cursorSanityCheck();
        }
        this.editing = true;

        this.trigger('block', [this.getBlockAroundSelection()]);
    },
    stopEditing : function() {
        Overlay.stopEdit(this);
        
        this._src.hide();
        this._html.show();

        this.sanitize();

        if (this.is_empty()) {
            this.source.addClass('discourse-empty').empty();
        } else {
            this.source.removeClass('discourse-empty');
        }

        console.log(this.getValue().src);

        this.source.attr('contenteditable', false)
                   .removeClass('discourse-editing');
        this.storage.setValue(this.getValue().src);
        this.storage.save();

        this._html.empty().append(this._src.html());

        //this.expandRepr();
        this.editing = false;
    },
    collapseRepr : function() {
        var map = this._repr = {};
        this.source.find('*[repr]').each(function(i, element){
            var e = $(element);
            var name = e.attr('repr');
            var repr = $('<div class="repr">' + name + "</div>");
            map[name.trim()] = e.replaceWith(repr);
        });
    },
    expandRepr : function() {
        map = this._repr;
        this.source.find('.repr').each(function(i, element) {
            var e = $(element);
            var name = e.html().trim();
            var source = map[name];
            if (source) {
                e.replaceWith(source);
            }
        });
    },
    onDocClick : function(e) {
        var in_document = ( e.target == this.source[0] || 
                            jQuery.contains(this.source[0], e.target) );
        var in_overlay  = ( e.target == Overlay.source[0] ||
                            jQuery.contains(Overlay.source[0], e.target) );
        if (in_document && !this.editing) {
            this.startEditing();
            if (e.target.nodeName == 'A') {
                Overlay.editLink($(e.target));
            }
            if (e.target.nodeName == 'IMG') {
                //Overlay.editImage($(e.target));
            }
        } else if (this.editing && !in_document && !in_overlay) {
            this.stopEditing();
        } else if (in_document && this.editing && e.target.nodeName == 'A') {
            Overlay.editLink($(e.target));
        } else if (in_document && this.editing && e.target.nodeName == 'IMG') {
            //Overlay.editImage($(e.target));
        }
    },
    onMouseup : function() {
        this.trigger('block', [this.getBlockAroundSelection()]);
    },
    onKeyDown : function(e) {
        // If you tab, that means you leave focus
        if (e.keyCode == 9) this.stopEditing();
        this.trigger('block', [this.getBlockAroundSelection()]);
    },
    onInput : function(e) {
        if (this.editing) {
            this.sanitize();
            this.cursorSanityCheck();
            this.storage.setValue(this.getValue().src);
        }
    },
    getValue : function() {
        return {
            'src': this._src.html().trim(),
            'html': this._html.html().trim()
        }
    },
    setValue : function(v) {
        this._src.html(v.src);
        this._html.html(v.html);
    },
    exec : function(name) {
        return this['command_' + name]();
    },
    command_p : function() { 
        var node = this.findClosestBlock();
        if (node.nodeName == 'UL' || node.nodeName == 'OL') {
            return this.command_outdent();
        } else if (node.nodeName != 'P') {
            document.execCommand("formatBlock", false, "p");
            return this.sanitize();
        }
    },
    command_blockquote : function(cls) {
        this.command_indent();
        if (cls) {
            window._node = this.findClosestBlock();
            var node = $(this.findClosestBlock()).nearest('blockquote');
            node.addClass(cls);
        }
    },
    command_h : function() {
        document.execCommand('outdent'); document.execCommand('outdent');
        document.execCommand("formatBlock", false, "h4"); this.sanitize();
    },
    command_h5 : function() {
        document.execCommand('outdent'); document.execCommand('outdent');
        document.execCommand("formatBlock", false, "h5"); this.sanitize();
    },
    command_ul: function() { document.execCommand("insertUnorderedList"); this.sanitize(); },
    command_ol: function() { document.execCommand("insertOrderedList"); this.sanitize(); },
    command_indent: function() { document.execCommand("indent"); this.sanitize(); },
    command_outdent: function() { document.execCommand("outdent"); this.sanitize(); },
    command_bold: function() { document.execCommand("bold") },
    command_italic: function() { document.execCommand("italic") },
    command_strikethrough: function() { document.execCommand("strikethrough") },
    command_subscript: function() { document.execCommand("subscript") },
    command_superscript: function() { document.execCommand("superscript") },
    command_link: function() { 
        document.execCommand("createLink", false, 'http://example.com');
        var a = $(window.getSelection().focusNode.parentNode);
        Overlay.editLink(a);
    },
    command_import: function() {
        //document.execCommand("insertHTML", false, '<img width="50" height="50" src=""/>');
        var media_src = Overlay.importMedia(this);
        if (media_src)
            document.execCommand("insertHTML", false, '<img src="' + media_src + '"/>');
    },
    is_empty : function() {
        return (this._src.text().trim() == '' && this._src.find('image').length == 0);
    },
    sanitize : function() {
        var src = this._src;

        // Unwrap unnatural structures.
        while(src.find('p p').length > 0) { src.find('p p').unwrap(); }
        while(src.find('p ul').length > 0) { src.find('p ul').unwrap(); }
        while(src.find('p ol').length > 0) { src.find('p ol').unwrap(); }

        // Get rid of orphaned li tags.
        src.children('li').contents().unwrap();
        
        // Tags allowed to be in the first level.
        var first_level = ['p', 'h4', 'blockquote', 'ul', 'ol', 'div', 'table'];

        // Remove style tags on blockquotes / paragraphs, wtf.
        src.find('p').attr('style', null);
        src.find('blockquote').attr('style', null);

        // Remove tags that are banned
        $("span").each(function(){
            $(this).replaceWith($(this).html());
        });
        
        // Move all orphans into a paragraph.
        var orphans = [];
        src.contents().each(function(i) {
            if (!this.tagName || $.inArray(this.tagName.toLowerCase(), first_level) < 0) {
                orphans.push(this);
            } else if (orphans.length > 0) {
                $('<p>').append(orphans).insertBefore(this);
                orphans = [];
            }
        });
        if (orphans.length > 0) {
            $('<p>').append(orphans).appendTo(src);
        }
    },
    cursorSanityCheck : function() {
        var src = this._src;

        // Ensures the cursor that there is at least one block object.
        if (src.children().length == 0) {
            var p = $("<p>&nbsp;</p>");
            src.empty().append(p);
            this.selectAllChildren( p );
            return;
        }

        // Check if our selection outside of a block, if so put it in the first child.
        var sel = window.getSelection();
        if ( sel.anchorNode == src[0] ) {
            var range = document.createRange();
            range.selectNodeContents(src.children()[0]);
            range.collapse(false);
            sel.removeAllRanges(); //(sel.getRangeAt(0));
            sel.addRange(range);
        }
    },
    insert : function(src) {
        window.getSelection();
    },
    selectAllChildren : function(obj) {
        window.getSelection().selectAllChildren(obj[0]);
    },
    findClosestBlock : function() {
        var base = this._src[0];
        var sel = window.getSelection();
        var blocks = this.block_types;
        var node = sel.anchorNode;

        while (node) {
            var i = jQuery.inArray(node.tagName, blocks);
            if (i > -1) return node;
            if (node == base) break;
            node = node.parentNode;
        }

        return null;
    },
    getBlockAroundSelection : function() {
        var block = this.findClosestBlock();
        if (block)
            return block.nodeName;
    }
});

