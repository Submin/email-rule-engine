var RuleEngine = {
    ui: {
        initDialog: $('#init-modal-dialog'),
        fatalErrDialog: $('#error-modal-dialog'),
        chooseDirBtn: $('.choose-dir-btn'),
        chooseFileBtn: $('.choose-rules-file-btn'),
        runEditorBtn: $('#run-editor-btn'),
        preEditBtn: $('.last-action-btn')
    },

    init() {
        var that = this;

        this.actions    = [];
        this.conditions = [];
        this.rules      = [];
        this.nodes      = [];
        this.node_id    = 0;

        this.ui.chooseDirBtn.on('click', function(e) {
            var button = $(e.target);
            button.blur();

            var target = button.data('target');

            var dirEntryPromise = new Promise((resolve, reject) => {
                chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function(theEntry) {
                    if (!theEntry) reject(
                        new Error('No Directory selected.')
                    );
                    
                    // use local storage to retain access to this file
                    chrome.storage.local.set({'chosenFile': chrome.fileSystem.retainEntry(theEntry)});
                    FileSystem.loadDirEntry(theEntry, resolve, reject);
                });
            });
            
            dirEntryPromise.then(
                value => {
                    that[target] = value;
                    
                    button.removeClass('btn-primary')
                        .addClass('btn-success')
                        .prop("disabled", true)
                        .html(target[0].toUpperCase()+target.slice(1)+' Directory is loaded')
                        .next().html('&nbsp;');

                    if (that.actions.length > 0 && that.conditions.length > 0) {
                        that.ui.preEditBtn.removeClass('btn-secondary').addClass('btn-primary').prop("disabled", false);
                    }
                },
                reason => {
                    console.log(reason.message);
                    button.next().text(reason.message); //лепим аларм в подбатонное пространство small
                }
            );
        });

        this.ui.chooseFileBtn.on('click', function(e) {
            $(event.target).blur();
            
            var accepts = [{
                mimeTypes: ['text/*', 'application/json'],
                extensions: ['json']
            }];
            var fileEntryPromise = new Promise((resolve, reject) => {
                chrome.fileSystem.chooseEntry({type: 'openFile', accepts: accepts}, function(theEntry) {
                    if (!theEntry) {
                        output.textContent = 'No file selected.';
                        return;
                    }
                    // use local storage to retain access to this file
                    chrome.storage.local.set({'chosenFile': chrome.fileSystem.retainEntry(theEntry)});
                    FileSystem.loadFileEntry(theEntry, resolve, reject);
                });
            });

            fileEntryPromise.then(
                value => {
                    that[target] = value;
                    
                    if (that.actions.length > 0 && that.conditions.length > 0)
                        that.run();
                },
                reason => {
                    console.log(reason.message);
                }
            );
        });

        this.ui.runEditorBtn.on('click', function(e) {
            var button = $(e.target);

            var message = undefined;
            if (that.actions.length < 1) message = 'Do you have empty the Actions'
            else if (that.conditions.length < 1) message = 'Do you have empty the Conditions'

            if (message) {
                that.ui.initDialog.modal('hide');
                that.ui.fatalErrDialog.find('.error-message-container').text(message);
                that.ui.fatalErrDialog.modal('show');
                return false;
            }

            that.ui.initDialog.modal('hide');
            that.run();
        });
        
        // заставляем пользователя загрузить необходимые данные
        this.ui.initDialog.modal('show');
    },
    
    run() {
        var editor = RuleEngine.Editor.create(this);
        editor.run();
    },
};

RuleEngine.Editor = {
    ui: {
        nodeDialog: $('#node-modal-dialog'),
        addNodeBtn: $('#add-node-btn'),
        delNodeBtn: $('#del-node-btn'),
        saveNodeBtn: $('#save-node-btn'),
        /*showNodeBtn: '.show-node-btn',*/
        nodeNameFld: $('#node-name-input'),
        nodeTitleFld: $('#node-title-input'),
        nodePairsContainer: $('#node-pairs-container tbody'),

        pairDialog: $('#pair-modal-dialog'),
        addPairBtn: $('#add-pair-btn'),
        savePairBtn: $('#save-pair-btn'),
        pairNameFld: $('#pair-name-input'),
        pairDescFld: $('#pair-desc-input'),
        pairConditionContainer: $('#pair-condition-container'),
        pairActionContainer: $('#pair-action-container')
    },

    create(engine) {
        var editor = Object.create(RuleEngine.Editor);
        editor.init(engine);
        
        return editor;
    },
    init(engine) {
        var that = this;

        // single input
        this.inputs  = [{name: 'I', desc: 'Input of node'}];
        this.outputs = [
            {name: 'first pair'},
            {name: 'second pair'},
            {name: 'third pair'},
            {name: 'fourth pair'},
            {name: 'fifth pair'},
            {name: '6 pair'}
        ];

        this.engine = engine;

        this.editor = Ned.create("#svg");

        this.editor.screenToWorld = function(pos) {
            var rect = this.svg.getBoundingClientRect();

            return { 
                x: (pos.x - rect.left), 
                y: (pos.y - rect.top)
            };
        };

        this.editor.singleOutputs = true;

        this.node = Object.create(RuleEngine.Node);
        this.node.init(this);

        this.pair = Object.create(RuleEngine.Pair);
        this.pair.init(this);

        Array.prototype.move = function (from, to) {
            this.splice(to, 0, this.splice(from, 1)[0]);
        };

        /* $('html').on('click', this.ui.showNodeBtn, function(e) {
            that.showNode(e.target.ref);
        });*/
        $('html').keyup( function(e) {
            if(e.keyCode == 46) that.destroyNode();
        });
        this.ui.delNodeBtn.on('click', function(e) {
            that.destroyNode();
        });
        this.ui.addNodeBtn.on('click', function(e) {
            that.showNode();
        });
        this.ui.saveNodeBtn.on('click', function(e) {
            that.saveNode(e.target.ref)
        });
        this.ui.addPairBtn.on('click', function(e) {
            that.showPair();
        });
        this.ui.savePairBtn.on('click', function(e) {
            that.savePair(e.target.ref);
        });

        this.ui.pairDialog.on('hidden.bs.modal', function (e) {
            that.ui.nodeDialog.modal('show');
        });
    },
    run() {
        if (this.engine.rules.length > 0) {
            this.loadRules(this.engine.rules);
        /* } else {
            this.node.create(this.engine.start_node);
        */
        }
    },
    destroyNode() {
        for(let node of this.editor.selectedNodes) {
            if (node.id == 0) continue;
            node.destroy();
        }
        this.editor.selectedNodes = [];
    },
    showNode(node) {
        var modalTitle = 'Node creation dialog';
        var btnTitle   = 'Create';
        var nodeName   = '';
        var nodeTitle  = '';
        var tData      = this.outputs;

        if (node) {
            this.ui.saveNodeBtn.ref = node;
            modalTitle = 'Node properties dialog';
            btnTitle   = 'Save';
            nodeName   = node.name;
            nodeTitle  = node.title;
            tData      = node.outputs;
        }

        var pairRows   = this._buildPairRows(tData);

        this.ui.nodeDialog.find('h5.modal-title').text(modalTitle);

        this.ui.nodeNameFld.val(nodeName);
        this.ui.nodeTitleFld.val(nodeTitle);
        this.ui.saveNodeBtn.text(btnTitle);
        this.ui.nodePairsContainer.html(pairRows);

        this.ui.nodePairsContainer.sortable().bind('sortupdate', function(e, ui) {
            var old_i = ui.item.data('index');

            // this - is tbody
            $(this).find('tr').each(function(i, row) {
                // $('th:eq(0)', row).text(i);
                $(row).data('index', i);
            });

            var new_i = ui.item.data('index');

            tData.move(old_i, new_i);
        });

        this.ui.nodeDialog.modal('show');
    },
    saveNode(node) {
        var name  = this.ui.nodeNameFld.val();
        var title = this.ui.nodeTitleFld.val();

        if (!name) {
            this.ui.nodeNameFld.next().text('The Name field is required');
            return false;
        }
        
        this.ui.nodeDialog.modal('hide');

        title = title || name; 

        if (!node) {
            node = this.node.create(title);

            var that = this;
            var nShowPropBtn = $('<i/>');
            /*  nShowPropBtn.ref = node; */
            nShowPropBtn.attr('aria-hidde', "true");
            nShowPropBtn.attr('title', "Edit node properties");
            nShowPropBtn.addClass("fa fa-cogs text-primary control-btn cursor-default");
            nShowPropBtn.addClass("show-node-btn");
            nShowPropBtn.click(function(e) { that.showNode(node); });
            $(node.eForeign).append(nShowPropBtn);
        }

        var node_props = {
            name: name,
            title: title,
            inputs: this.inputs,
            outputs: this.outputs
        };

        this.node.save(node, node_props);

        this._cleanNodeData();
    },
    showPair(pair) {
        var modalTitle = 'Pair creation dialog';
        var btnTitle   = 'Create';
        var pairName   = '';
        var pairDesc   = '';

        if (pair) {
            this.ui.savePairBtn.ref = pair;
            modalTitle = 'Edit pair properties dialog';
            btnTitle   = 'Save';
            pairName   = pair.name;
            pairDesc   = pair.desc;
            // pairRows   = this._buildPairRows(node.outputs);
        }

        this.ui.pairDialog.find('h5.modal-title').text(modalTitle);

        this.ui.pairNameFld.val(pairName);
        this.ui.pairDescFld.val(pairDesc);
        //this.ui.nodeDialog.find('tbody').empty().append(pairRows);
        this.ui.savePairBtn.text(btnTitle);

        this.ui.nodeDialog.modal('hide');
        this.ui.pairDialog.modal('show');
    },
    savePair(pair) {
        var name = this.ui.pairNameFld.val();
        var desc = this.ui.pairDescFld.val();

        if (!name) {
            this.ui.nodeNameFld.next().text('The Name field is required');
            return false;
        }
        
        this.ui.nodeDialog.modal('hide');

        title = title || name; 

        if (!node) {
            node = this.node.create(title);

            var that = this;
            var nShowPropBtn = $('<i/>');
            /*  nShowPropBtn.ref = node; */
            nShowPropBtn.attr('aria-hidde', "true");
            nShowPropBtn.attr('title', "Edit node properties");
            nShowPropBtn.addClass("fa fa-cogs text-primary control-btn cursor-default");
            nShowPropBtn.addClass("show-node-btn");
            nShowPropBtn.click(function(e) { that.showNode(node); });
            $(node.eForeign).append(nShowPropBtn);
        }

        var node_props = {
            name: name,
            title: title,
            inputs: this.inputs || this.defInputs,
            outputs: this.outputs || this.defOutputs
        };

        this.node.save(node, node_props);

        this._cleanNodeData();
    },

    _cleanNodeData() {
        this.ui.saveNodeBtn.empty();
        delete this.ui.saveNodeBtn.ref;
        this.outputs = [];
    },
    _buildPairRows(outputs) {
        var that = this;
        var rows = [];
        outputs || (outputs = []);

        outputs.forEach(function(conn, i) {
            var cog_btn = $('<div class="control-btn cursor-default" title="Edit pair"></div>')
                .on('click', function(e) { that.showPair(conn) })
                .append(
                    $('<i class="fa fa-cog text-primary" aria-hidde="true"></i>')
                 );
            var trash_btn = $('<div class="control-btn cursor-default" title="Delete pair"></div>')
                .on('click', function(e) { if(that.destroyPair(conn)) e.target.remove() })
                .append(
                    $('<i class="fa fa-trash text-danger" aria-hidde="true"></i>')
                 );
            var button_grp = $('<div class="btn-group" data-toggle="buttons"></div>').append(cog_btn, trash_btn);

            var row = $('<tr data-index="'+i+'" class="cursor-pointer"></tr>')
                .append(
                    // $('<th scope="row">'+i+'</th>'),
                    $('<td class="w-100" />').text(conn.name),
                    $('<td class="text-right"/>').append(button_grp)
                );

            rows.push(row);
        });

        return rows;
    }

};

RuleEngine.Node = {
    init(ed) {
        var that = this;

        this.ed     = ed;
        this.editor = ed.editor;
        this.engine = ed.engine;
    },

    create(title) {
        return this.editor.createNode(title);
    },

    save(node, props) {
        node.id = this.engine.props_id++;
        node.name = props.name;
        node.title = props.title;

        node.position = {
            x: props.x ? props.x : 100,
            y: props.y ? props.y : 100
        };

        node.size = {
            width: props.width ? props.width : 250,
            // height: props.height ? props.height : 100
        };

        props.inputs = props.inputs || [];
        props.inputs.forEach(function(item) {
            node.addInput(item);
        });

        props.outputs = props.outputs || [];
        props.outputs.forEach(function(item) {
            node.addOutput(item);
        });
    }
};

RuleEngine.Pair = {
    init(ed) {
        var that = this;

        this.ed     = ed;
        this.editor = ed.editor;
        this.engine = ed.engine;
    },

    build() {
        $('#create-pair-modal').modal('show');
        return 1;
    },
    save(conn) {
        return 1;
    },
    destroy(conn) {
        conn.destroy();
        return 1;
    }
};

RuleEngine.init();
