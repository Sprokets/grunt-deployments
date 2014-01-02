/*
 * grunt-deployments
 * https://github.com/getdave/grunt-deployments
 *
 * Copyright (c) 2013 David Smith
 * Licensed under the MIT license.
 */

'use strict';

// Global
var shell = require('shelljs');

// Library modules
var tpls        = require('../lib/tpls');
var dbReplace   = require('../lib/dbReplace');
var dbDump      = require('../lib/dbDump');

// Only Grunt registration within this "exports"
module.exports = function(grunt) {

    /**
     * DB PUSH
     * pushes local database to remote database
     */
    grunt.registerTask('db_push', 'Push to Database', function() {

        // Options
        var task_options    = grunt.config.get('deployments')['options'];

        // Get the target from the CLI args
        var target = grunt.option('target') || task_options['target'];

        if ( typeof target === "undefined" || typeof grunt.config.get('deployments')[target] === "undefined")  {
            grunt.fail.warn("Invalid target specified. Did you pass the wrong argument? Please check your task configuration.", 6);
        }

        // Grab the options from the shared "deployments" config options
        var target_options      = grunt.config.get('deployments')[target];
        var local_options       = grunt.config.get('deployments').local;

        // Generate required backup directories and paths
        var local_backup_paths  = generate_backup_paths("local", task_options);
        var target_backup_paths = generate_backup_paths(target, task_options);


        grunt.log.subhead("Pushing database from 'Local' to '" + target_options.title + "'");


        // Dump local DB
        dbDump(local_options, local_backup_paths);

        // Search and Replace database refs
        dbReplace( local_options.url, target_options.url, local_backup_paths.file );

        // Dump target DB
        dbDump(target_options, target_backup_paths);

        // Import dump to target DB
        db_import(target_options, local_backup_paths.file);

        grunt.log.subhead("Operations completed");
    });


    /**
     * DB PULL
     * pulls remote database into local database
     */
    grunt.registerTask('db_pull', 'Pull from Database', function() {

        // Options
        var task_options    = grunt.config.get('deployments')['options'];

        // Get the target from the CLI args
        var target              = grunt.option('target') || task_options['target'];

        if ( typeof target === "undefined" || typeof grunt.config.get('deployments')[target] === "undefined")  {
            grunt.fail.warn("Invalid target provided. I cannot pull a database from nowhere! Please checked your configuration and provide a valid target.", 6);
        }



        // Grab the options from the shared "deployments" config options
        var target_options      = grunt.config.get('deployments')[target];
        var local_options       = grunt.config.get('deployments').local;

        // Generate required backup directories and paths
        var local_backup_paths  = generate_backup_paths("local", task_options);
        var target_backup_paths = generate_backup_paths(target, task_options);

        // Start execution
        grunt.log.subhead("Pulling database from '" + target_options.title + "' into Local");

        // Dump Target DB
        dbDump(target_options, target_backup_paths );

        dbReplace(target_options.url,local_options.url,target_backup_paths.file);

        // Backup Local DB
        dbDump(local_options, local_backup_paths);

        // Import dump into Local
        db_import(local_options,target_backup_paths.file);

        grunt.log.subhead("Operations completed");

    });



    function generate_backup_paths(target, task_options) {

        var rtn = [];

        var backups_dir = task_options['backups_dir'] || "backups";

        // Create suitable backup directory paths
        rtn['dir'] = grunt.template.process(tpls.backup_path, {
            data: {
                backups_dir: backups_dir,
                env: target,
                date: grunt.template.today('yyyymmdd'),
                time: grunt.template.today('HH-MM-ss'),
            }
        });


        rtn['file'] = rtn['dir'] + '/db_backup.sql';

        return rtn;
    }


    /**
     * Imports a .sql file into the DB provided
     */
    function db_import(config, src) {

        var cmd;

        // 1) Create cmd string from Lo-Dash template
        var tpl_mysql = grunt.template.process(tpls.mysql, {
            data: {
                host: config.host,
                user: config.user,
                pass: config.pass,
                database: config.database,
                path: src,
                port: config.port || 3306
            }
        });


        // 2) Test whether target MYSQL DB is local or whether requires remote access via SSH
        if (typeof config.ssh_host === "undefined") { // it's a local connection
            grunt.log.writeln("Importing into local database");
            cmd = tpl_mysql + " < " + src;
        } else { // it's a remote connection
            var tpl_ssh = grunt.template.process(tpls.ssh, {
                data: {
                    host: config.ssh_host
                }
            });

            grunt.log.writeln("Importing DUMP into remote database");

            cmd = tpl_ssh + " '" + tpl_mysql + "' < " + src;
        }

         // Execute cmd
        shell.exec(cmd);

        grunt.log.oklns("Database imported succesfully");
    }



    


    








};





