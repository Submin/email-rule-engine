var FileSystem = {
    readAsJson: function (file, resolve, reject) {
        var reader = new FileReader();
        reader.onerror = reject;
        reader.onloadend = function(e) {
            try {
                if ( !e.target.result )
                    throw new Error('File is empty');

                var data = JSON.parse(e.target.result);

                if ( !data )
                    throw new Error('Parsing error');

                if ( !FileSystem.validateContent(data) )
                    throw new Error('Wrong data');
                
                resolve( data );
            } catch ( error ) {
                // падаем если вызвано исключение
                reject( error );
            }
        };

        reader.readAsText(file);
    },
    
    validateContent: function (data) {
        return 1;
    },

    // for files, read the text content into the textarea
    loadFileEntry: function (chosenEntry, resolve, reject) {
        chosenEntry.file(function(file) {
            FileSystem.readAsJson(file, resolve, reject);
        });
    },

    // for directories, read the contents of the top-level directory (ignore sub-dirs)
    // and put the results into the textarea, then disable the Save As button
    loadDirEntry: function (chosenEntry, resolve, reject) {
        if (chosenEntry.isDirectory) {
            var dirReader = chosenEntry.createReader();
            var readEntries = function(_resolve, _reject) {
                dirReader.readEntries(function(results) {
                    var promises = [];
                    results.forEach(function(item) {
                        if (item.isFile) {
                            var p = new Promise((__resolve, __reject) => {
                                item.file(function(file) {
                                    FileSystem.readAsJson(file, __resolve, __reject);
                                });
                            });
                            promises.push(p);
                        }
                    });

                    Promise.all(promises).then(
                        values => {_resolve(values)},
                        reason => {_reject(reason)}
                    );
                }, _reject );
            };

            readEntries(resolve, reject); // Start reading dirs.
        }
    }
};

