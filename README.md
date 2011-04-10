Description
===========

node-ftp is an FTP client module for [node.js](http://nodejs.org/) that provides an asynchronous interface for communicating with an FTP server.


Requirements
============

* [node.js](http://nodejs.org/) -- v0.4.0 or newer


Examples
========

* Get a directory listing of the current working directory:

        var FTPClient = require('./ftp'), util = require('util'), conn;
        function formatDate(d) {
          return (d.year < 10 ? '0' : '') + d.year + '-' + (d.month < 10 ? '0' : '')
                 + d.month + '-' + (d.date < 10 ? '0' : '') + d.date;
        }
        conn = new FTPClient({ host: '127.0.0.1' });
        conn.on('connect', function() {
          conn.auth(function(e) {
            if (e)
              throw e;
            conn.list(function(e, iter) {
              if (e)
                throw e;
              var begin = false;
              iter.on('entry', function(entry) {
                if (!begin) {
                  begin = true;
                  console.log('<start of directory list>');
                }
                if (entry.type === 'l')
                  entry.type = 'LINK';
                else if (entry.type === '-')
                  entry.type = 'FILE';
                else if (entry.type === 'd')
                  entry.type = 'DIR.';
                console.log(' ' + entry.type + ' ' + entry.size + ' '
                              + formatDate(entry.date) + ' ' + entry.name);
              });
              iter.on('raw', function(s) {
                console.log('<raw entry>: ' + s);
              });
              iter.on('end', function() {
                console.log('<end of directory list>');
              });
              iter.on('error', function(e) {
                console.log('ERROR during list(): ' + util.inspect(e));
                conn.end();
              });
              iter.on('success', function() {
                conn.end();
              });
            });
          });
        });
        conn.connect();

* Download remote file 'foo.txt' and save it to the local file system:

        // Assume we have the same connection 'conn' from before and are currently
        // authenticated ...
        var fs = require('fs');
        conn.get('foo.txt', function(e, inStream) {
          if (e)
            throw e;
          stream.on('success', function() {
            conn.end();
          });
          stream.on('error', function(e) {
            console.log('ERROR during get(): ' + util.inspect(e));
            conn.end();
          });
          inStream.pipe(fs.createWriteStream('localfoo.txt'));
        });

* Upload local file 'foo.txt' to the server:

        // Assume we have the same connection 'conn' from before and are currently
        // authenticated ...
        var fs = require('fs');
        conn.put(fs.createReadStream('foo.txt'), 'remotefoo.txt', function(e) {
          if (e)
            throw e;
          conn.end();
        });


API
===

_Events_
--------

* **connect**() - Fires when a connection to the server has been successfully established.

* **timeout**() - Fires if the connection timed out while attempting to connect to the server.

* **close**(Boolean:hasError) - Fires when the connection is completely closed (similar to net.Socket's close event). The specified Boolean indicates whether the connection was terminated due to a transmission error or not.

* **end**() - Fires when the connection has ended.

* **error**(Error:err) - Fires when an exception/error occurs (similar to net.Socket's error event). The given Error object represents the error raised.


_Methods_
---------

**\* Note 1: If a particular action results in an FTP-specific error, the error object supplied to the callback or 'error' event will contain 'code' and 'text' properties that contain the relevant FTP response code and the associated error text respectively.**

**\* Note 2: Methods that return a Boolean success value will immediately return false if the action couldn't be carried out for reasons including: no server connection or the relevant command is not available on that particular server.**

### Standard

These are actions defined by the "original" FTP RFC (959) and are generally supported by all FTP servers.

* **(constructor)**([Object:config]) - Creates and returns a new instance of the FTP module using the specified configuration object. Valid properties of the passed in object are:
    * **String:host** - The hostname or IP address of the FTP server. **Default:** "127.0.0.1"
    * **Integer:port** - The port of the FTP server. **Default:** 21
    * **Function:debug** - Accepts a string and gets called for debug messages **Default:** (no debug output)
    * **Integer:connTimeout** - The number of milliseconds to wait for a connection to be established. **Default:** 60000

* **connect**([Number:port],[String:host]) - _(void)_ - Attempts to connect to the FTP server. If the port and host are specified here, they override and overwrite those set in the constructor.

* **end**() - _(void)_ - Closes the connection to the server.

* **auth**([String:username], [String:password], Function:callback) - _Boolean:success_ - Authenticates with the server (leave out username and password to log in as anonymous). The callback has these parameters: the error (undefined if none).

* **list**([String:path], Function:callback) - _Boolean:success_ - Retrieves the directory listing of the specified path. If path is not supplied, the current working directory is used. The callback has these parameters: the error (undefined if none) and an EventEmitter. The EventEmitter emits the following events:

    * **entry**(Object:entryInfo) - Fires for each file or subdirectory. entryInfo contains the following possible properties:
        * **String:name** - The name of the entry.
        * **String:type** - A single character denoting the entry type: 'd' for directory, '-' for file, or 'l' for symlink (UNIX only).
        * **String:size** - The size of the entry in bytes.
        * **Object:date** - The last modified date of the entry.
            * **Integer:month** - (1 through 12)
            * **Integer:date** - (1 through 31)
            * **Integer:year** - (1, 2, or 4-digits)
        * **[Object:time]** - The last modified time of the entry.
            * **Integer:hour** - (0 through 23)
            * **Integer:minute** - (0 through 59)
        * **Object:rights** - (UNIX only) - The various permissions for this entry.
            * **String:user** - Contains any combination of 'r', 'w', 'x', or an empty string.
            * **String:group** - Contains any combination of 'r', 'w', 'x', or an empty string.
            * **String:other** - Contains any combination of 'r', 'w', 'x', or an empty string.
        * **String:owner** - (UNIX only) - The user name or ID that this entry belongs to.
        * **String:group** - (UNIX only) - The group name or ID that this entry belongs to.
        * **[String:target]** - (UNIX only) - For symlink entries, this is the symlink's target.

    * **raw**(String:rawListing) - Fires when a directory listing couldn't be parsed and provides you with the raw directory listing line.

    * **end**() - Fires when the server has finished sending the directory listing, which may or may not be due to error.

    * **success**() - Fires when the server says it successfully sent the entire directory listing.

    * **error**(Error:err) - Fires when an error was encountered while obtaining the directory listing.

* **pwd**(Function:callback) - _Boolean:success_ - Retrieves the current working directory. The callback has these parameters: the error (undefined if none) and a string containing the current working directory.

* **cwd**(String:newPath, Function:callback) - _Boolean:success_ - Changes the current working directory to newPath. The callback has these parameters: the error (undefined if none).

* **get**(String:filename, Function:callback) - _Boolean:success_ - Retrieves a file from the server. The callback has these parameters: the error (undefined if none) and a ReadableStream. The ReadableStream will emit 'success' if the file was successfully transferred.

* **put**(ReadableStream:inStream, String:filename, Function:callback) - _Boolean:success_ - Sends a file to the server. The callback has these parameters: the error (undefined if none).

* **append**(ReadableStream:inStream, String:filename, Function:callback) - _Boolean:success_ - Same as **put**, except if the file already exists, it will be appended to instead of overwritten.

* **mkdir**(String:dirname, Function:callback) - _Boolean:success_ - Creates a new directory on the server. The callback has these parameters: the error (undefined if none) and a string containing the path of the newly created directory.

* **rmdir**(String:dirname, Function:callback) - _Boolean:success_ - Removes a directory on the server. The callback has these parameters: the error (undefined if none).

* **delete**(String:entryName, Function:callback) - _Boolean:success_ - Deletes a file on the server. The callback has these parameters: the error (undefined if none).

* **rename**(String:oldFilename, String:newFilename, Function:callback) - _Boolean:success_ - Renames a file on the server. The callback has these parameters: the error (undefined if none).

* **system**(Function:callback) - _Boolean:success_ - Retrieves information about the server's operating system. The callback has these parameters: the error (undefined if none) and a string containing the text returned by the server.

* **status**(Function:callback) - _Boolean:success_ - Retrieves human-readable information about the server's status. The callback has these parameters: the error (undefined if none) and a string containing the text returned by the server.


### Extended

These are actions defined by later RFCs that may not be supported by all FTP servers.

* **size**(String:filename, Function:callback) - _Boolean:success_ - Retrieves the size of the specified file. The callback has these parameters: the error (undefined if none) and a string containing the size of the file in bytes.

* **lastMod**(String:filename, Function:callback) - _Boolean:success_ - Retrieves the date and time the specified file was last modified. The callback has these parameters: the error (undefined if none) and an object with the following properties:

    * **Integer:entry**(Object:entryInfo) - Fires for each file or subdirectory. entryInfo contains the following possible properties:
    * **Integer:month** - (1 through 12)
    * **Integer:date** - (1 through 31)
    * **Integer:year** - (4-digit)
    * **Integer:hour** - (0 through 23)
    * **Integer:minute** - (0 through 59)
    * **Float:second** - (0 through 60 -- with 60 being used only at a leap second)

* **restart**(String/Integer:byteOffset, Function:callback) - _Boolean:success_ - Sets the file byte offset for the next file transfer action (get/put/append). The callback has these parameters: the error (undefined if none).
