Description
===========

node-ftp is an FTP client module for [node.js](http://nodejs.org/) that provides an asynchronous interface for communicating with an FTP server.


Requirements
============

* [node.js](http://nodejs.org/) -- v0.4.0 or newer

Install
============

npm install ftp

Examples
========

* Get a pretty-printed directory listing of the current (remote) working directory:

```javascript
  var FTPClient = require('ftp');

  // connect to localhost:21
  var conn = new FTPClient();
  conn.on('connect', function() {
    // authenticate as anonymous
    conn.auth(function(e) {
      if (e)
        throw e;
      conn.list(function(e, entries) {
        if (e)
          throw e;
        console.log('<start of directory list>');
        for (var i=0,len=entries.length; i<len; ++i) {
          if (typeof entries[i] === 'string')
            console.log('<raw entry>: ' + entries[i]);
          else {
            if (entries[i].type === 'l')
              entries[i].type = 'LINK';
            else if (entries[i].type === '-')
              entries[i].type = 'FILE';
            else if (entries[i].type === 'd')
              entries[i].type = 'DIR';
            console.log(' ' + entries[i].type + ' ' + entries[i].size
                        + ' ' + entries[i].date + ' ' + entries[i].name);
          }
        }
        console.log('<end of directory list>');
        conn.end();
      });
    });
  });
  conn.connect();
```

* Download remote file 'foo.txt' and save it to the local file system:

```javascript
  // Assume we have the same connection 'conn' from before and are currently
  // authenticated ...
  var fs = require('fs');
  conn.get('foo.txt', function(e, stream) {
    if (e)
      throw e;
    stream.on('success', function() {
      conn.end();
    });
    stream.on('error', function(e) {
      console.log('ERROR during get(): ' + e);
      conn.end();
    });
    stream.pipe(fs.createWriteStream('localfoo.txt'));
  });
```

* Upload local file 'foo.txt' to the server:

```javascript
  // Assume we have the same connection 'conn' from before and are currently
  // authenticated ...
  var fs = require('fs');
  conn.put(fs.createReadStream('foo.txt'), 'remotefoo.txt', function(e) {
    if (e)
      throw e;
    conn.end();
  });
```

API
===

_Events_
--------

* **connect**() - Fires when a connection to the server has been successfully established.

* **timeout**() - Fires if the connection timed out while attempting to connect to the server.

* **close**(<_boolean_>hasError) - Fires when the connection is completely closed (similar to net.Socket's close event). The specified boolean indicates whether the connection was terminated due to a transmission error or not.

* **end**() - Fires when the connection has ended.

* **error**(<_Error_>err) - Fires when an exception/error occurs (similar to net.Socket's error event). The given Error object represents the error raised.


_Methods_
---------

**\* Note 1: If a particular action results in an FTP-specific error, the error object supplied to the callback or 'error' event will contain 'code' and 'text' properties that contain the relevant FTP response code and the associated error text respectively.**

**\* Note 2: Methods that return a boolean success value will immediately return false if the action couldn't be carried out for reasons including: no server connection or the relevant command is not available on that particular server.**

### Standard

These are actions defined by the "original" FTP RFC (959) and are generally supported by all FTP servers.

* **(constructor)**([<_object_>config]) - Creates and returns a new instance of the FTP module using the specified configuration object. Valid properties of the passed in object are:
    * <_string_>host - The hostname or IP address of the FTP server. **Default:** "localhost"
    * <_integer_>port - The port of the FTP server. **Default:** 21
    * <_integer_>connTimeout - The number of milliseconds to wait for a connection to be established. **Default:** 15000
    * <_function_>debug - Accepts a string and gets called for debug messages **Default:** (no debug output)

* **connect**(<_integer_>port,][<_string_>host]) - _(void)_ - Attempts to connect to the FTP server. If the port and host are specified here, they override and overwrite those set in the constructor.

* **end**() - _(void)_ - Closes the connection to the server.

* **auth**([<_string_>username, <_string_>password,] <_function_>callback) - <_boolean_>success - Authenticates with the server (leave out username and password to log in as anonymous). The callback has these parameters: the error (undefined if none).

* **list**([<_string_>path,] [<_boolean_>streamList,] <_function_>callback) - <_boolean_>success_ - Retrieves the directory listing of the specified path. path defaults to the current working directory. If streamList is set to true, an EventEmitter will be passed to the callback, otherwise an array of objects (format shown below) and raw strings will be passed in to the callback. The callback has these parameters: the error (undefined if none) and a list source. If streaming the list, the following events are emitted on the list source:

    * **entry**(<_object_>entryInfo) - Emitted for each file or subdirectory. entryInfo contains the following possible properties:
        * <_string_>name - The name of the entry.
        * <_string_>type - A single character denoting the entry type: 'd' for directory, '-' for file, or 'l' for symlink (UNIX only).
        * <_string_>size - The size of the entry in bytes.
        * <_Date_>date - The last modified date of the entry.
        * <_object_>rights - **(*NIX only)** - The various permissions for this entry.
            * <_string_>user - An empty string or any combination of 'r', 'w', 'x'.
            * <_string_>group - An empty string or any combination of 'r', 'w', 'x'.
            * <_string_>other - An empty string or any combination of 'r', 'w', 'x'.
        * <_string_>owner - **(*NIX only)** - The user name or ID that this entry belongs to.
        * <_string_>group - **(*NIX only)** - The group name or ID that this entry belongs to.
        * <_string_>target - **(*NIX only)** - For symlink entries, this is the symlink's target.

    * **raw**(<_string_>rawListing) - Emitted when a directory listing couldn't be parsed and provides you with the raw directory listing from the server.

    * **end**() - Emitted when the server has finished sending the directory listing, which may or may not be due to error.

    * **success**() - Emitted when the server says it successfully sent the entire directory listing.

    * **error**(<_Error_>err) - Emitted when an error was encountered while obtaining the directory listing.

* **pwd**(<_function_>callback) - <_boolean_>success - Retrieves the current working directory. The callback has these parameters: the error (undefined if none) and a string containing the current working directory.

* **cwd**(<_string_>newPath, <_function_>callback) - <_boolean_>success - Changes the current working directory to newPath. The callback has these parameters: the error (undefined if none).

* **cdup**(<_function_>callback) - <_boolean_>success - Changes the working directory to the parent of the current directory. The callback has these parameters: the error (undefined if none).

* **get**(<_string_>filename, <_function_>callback) - <_boolean_>success - Retrieves a file from the server. The callback has these parameters: the error (undefined if none) and a ReadableStream. The ReadableStream will emit 'success' if the file was successfully transferred.

* **put**(<_mixed_>input, <_string_>filename, <_function_>callback) - <_boolean_>success - Sends a file to the server. The `input` can be a ReadableStream or a single Buffer. The callback has these parameters: the error (undefined if none).

* **append**(<_mixed_>input, <_string_>filename, <_function_>callback) - <_boolean_>success - Same as **put**, except if the file already exists, it will be appended to instead of overwritten.

* **mkdir**(<_string_>dirname, <_function_>callback) - <_boolean_>success - Creates a new directory on the server. The callback has these parameters: the error (undefined if none) and a string containing the path of the newly created directory.

* **rmdir**(<_string_>dirname, <_function_>callback) - <_boolean_>success - Removes a directory on the server. The callback has these parameters: the error (undefined if none).

* **delete**(<_string_>entryName, <_function_>callback) - <_boolean_>success - Deletes a file on the server. The callback has these parameters: the error (undefined if none).

* **rename**(<_string_>oldFilename, <_string_>newFilename, <_function_>callback) - <_boolean_>success - Renames a file on the server. The callback has these parameters: the error (undefined if none).

* **system**(<_function_>callback) - <_boolean_>success - Retrieves information about the server's operating system. The callback has these parameters: the error (undefined if none) and a string containing the text returned by the server.

* **status**(<_function_>callback) - <_boolean_>success - Retrieves human-readable information about the server's status. The callback has these parameters: the error (undefined if none) and a string containing the text returned by the server.


### Extended

These are actions defined by later RFCs that may not be supported by all FTP servers.

* **size**(<_string_>filename, <_function_>callback) - <_boolean_>success - Retrieves the size of the specified file. The callback has these parameters: the error (undefined if none) and a string containing the size of the file in bytes.

* **lastMod**(<_string_>filename, <_function_>callback) - <_boolean_>success - Retrieves the date and time the specified file was last modified. The callback has these parameters: the error (undefined if none) and a _Date_ instance representing the last modified date.

* **restart**(<_mixed_>byteOffset, <_function_>callback) - <_boolean_>success - Sets the file byte offset for the next file transfer action (get/put/append). byteOffset can be an _integer_ or _string_. The callback has these parameters: the error (undefined if none).
