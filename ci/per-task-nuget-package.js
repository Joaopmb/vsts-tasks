// Overview:

// This script starts with having a folder per task with the content for each task inside.
// We start by adding a .nuspec file for each task inside the task folder.
// Then we iterate each of these tasks and create a .nupkg and push.cmd per task.

// Folder structure:

// _package
//  /per-task-layout (util.perTaskLayoutPath)
//      /TASK
//          task contents
//          {task name and info}.nuspec *created in this script
//  /per-task-publish (util.perTaskPublishPath)
//      /TASK
//          {task name and info}.nupkg *created in this script, think this is actually .nuspec
//          push.cmd *created in this script

// Notes:

// Currently the code works within the legacy setup of having multiple slices that are pushed as artifacts and then recombined.
// Once this code is live for a while we will remove that legacy code and it should simplify the setup here. We can use the original 
//    build folders for each task in place of the per-task-layout.














var fs = require('fs');
var os = require('os');
var path = require('path');
var util = require('./ci-util');

// build only what's changed, do that later. It happens upstream anyways, not here.


// If this flag is set we want to stage the per task nuget files.
// After this is fully working we can refactor again and clean up all the aggregate code.
// Trying to make this code change in such a way that we only need to delete aggregate 
//      files later and not redo any of the nuget package per task code.
if (process.env.DISTRIBUTEDTASK_USE_PERTASK_NUGET) {
    console.log('> printing folder structure before starting');

    const getAllFiles = dir =>
        fs.readdirSync(dir).reduce((files, file) => {
            const name = path.join(dir, file);
            const isDirectory = fs.statSync(name).isDirectory();
            return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
        }, []);

    getAllFiles(util.packagePath).forEach(function (f) { 
        console.log(f);
    });

    console.log('> Zipping nuget package per task');

    // mkdir _package/per-task-layout
    console.log('> Creating folder _package/per-task-layout');
    fs.mkdirSync(util.perTaskLayoutPath);
    fs.mkdirSync(util.publishNugetPerTaskPath); // make the folder that we will publish, publish-per-task

    // TODO: Below this line needs to be refactored for the per task nuget setup.

    // TODO: I think we need to make changes here but start with this and see where it goes.
    // console.log('> Linking aggregate layout content to per-task-layout path, may need to change this');
    // //var commitHash = refs.head.commit;

    var commitHash = 'aaaaaa';
    var taskDestMap = {}; // I don't think this is actually used for anything?
    util.linkAggregateLayoutContent(util.milestoneLayoutPath, util.perTaskLayoutPath, '', commitHash, taskDestMap);

    getAllFiles(util.packagePath).forEach(function (f) { 
        console.log(f);
    });
    
    // fs.readdirSync(util.aggregateLayoutPath) // walk each item in the aggregate layout
    //     .forEach(function (itemName) {
    //         util.
    //     });

    // Iterate all the folders inside util.perTaskLayoutPath and create a nuspec file, pack, and create push.cmd
    console.log();
    console.log('> Iterating all folders in per-task-layout');

    fs.readdirSync(util.perTaskLayoutPath) // walk each item in the aggregate layout
        .forEach(function (taskName) {
            if (taskName.indexOf('aaaaaa') > -1) {
                // For some reason there is also D:\a\1\s\_package\per-task-layout\AzurePowerShellV3__v3_aaaaaa
                return;
            }

            var taskPath = path.join(util.perTaskLayoutPath, taskName); // e.g. - _package\per-task-layout\AzurePowerShellV3__v3. For some reason there is also D:\a\1\s\_package\per-task-layout\AzurePowerShellV3__v3_aaaaaa
            console.log();
            console.log('> Task path exists: ' + fs.existsSync(taskPath));
            console.log('> Task path: ' + taskPath);

            // create the nuspec file for task
            console.log('> Generating .nuspec file');

            // TODO: Also load from task.json
            var taskVersion = 00001;

            var contents = '<?xml version="1.0" encoding="utf-8"?>' + os.EOL;
            contents += '<package xmlns="http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd">' + os.EOL;
            contents += '   <metadata>' + os.EOL;
            contents += '      <id>' + taskName + '</id>' + os.EOL;
            contents += '      <version>' + taskVersion + '</version>' + os.EOL;
            contents += '      <authors>bigbldt</authors>' + os.EOL;
            contents += '      <owners>bigbldt,Microsoft</owners>' + os.EOL;
            contents += '      <requireLicenseAcceptance>false</requireLicenseAcceptance>' + os.EOL;
            contents += '      <description>For VSS internal use only</description>' + os.EOL;
            contents += '      <tags>VSSInternal</tags>' + os.EOL;
            contents += '   </metadata>' + os.EOL;
            contents += '</package>' + os.EOL;




            // TODO: We need one folder for the task contents and nuspec file(per-task-layout), then another folder(publish-per-task) that has a folder per task and inside
            //       each folder we have the push.cmd and nupkg. We can publish from publishNugetPerTaskPath.




            // Careful, what about major version in folder names? Need to parse task.json and use that.... maybe
            console.log('> writing nuspec file');
            var taskNuspecPath = path.join(taskPath, 'Mseng.MS.TF.Build.Tasks.' + taskName + '.nuspec'); // e.g. - _package\per-task-layout\AzureCLIV1__v1\Mseng.MS.TF.Build.Tasks.AzureCLIV1__v1.nuspec
            console.log('taskNuspecPath: ' + taskNuspecPath);
            fs.writeFileSync(taskNuspecPath, contents);

            // pack
            console.log('> packing nuget package for task ' + taskName);
            var taskPublishFolder = path.join(util.publishNugetPerTaskPath, taskName);
            var taskNuspecPath = path.join(taskPublishFolder, taskName + ".nuspec");

            fs.mkdirSync(taskPublishFolder); // make the folder that we will publish, publish-per-task
            process.chdir(taskPublishFolder);
            //fs.writeFileSync(path.join(taskPublishFolder, 'test.txt'), 'Here is my file content');
            util.run(`nuget pack "${taskNuspecPath}" -BasePath "${taskPath}" -NoDefaultExcludes`, /*inheritStreams:*/true); // this must create the nupkg from the nuspec

            // create push.cmd
            console.log('> creating push.cmd for task ' + taskName);
            var taskPushCmdPath = path.join(taskPublishFolder, 'push.cmd'); // e.g. - _package\publish-per-task\AzureCLIV1__v1\push.cmd

            // TODO: These packages need to have the task version in the name
            // TODO: Need to get task name from task.json not the folder.
            var taskVersion = '0.0.0'; // TODO: Get from task.json too
            var nupkgName = `Mseng.MS.TF.Build.Tasks.${taskName}.${taskVersion}.nupkg`;
            var taskFeedUrl = process.env.AGGREGATE_TASKS_FEED_URL; // Need the task feed per task. This is based on task name from task.json too.
            fs.writeFileSync(util.taskPushCmdPath, `nuget.exe push ${nupkgName} -source "${taskFeedUrl}" -apikey Skyrise`);
        });


    console.log('> ');

    console.log('> ');

    console.log('> ');

    getAllFiles(util.packagePath).forEach(function (f) { 
        console.log(f);
    });
}

// TODO: Make sure we have a step later that then publishes this artifact.






