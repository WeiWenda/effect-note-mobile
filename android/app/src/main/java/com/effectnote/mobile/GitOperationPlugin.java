package com.effectnote.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Environment;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.Constants;
import org.eclipse.jgit.lib.FileMode;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.ObjectLoader;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevTree;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.eclipse.jgit.treewalk.TreeWalk;
import org.eclipse.jgit.treewalk.filter.PathFilter;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "GitOperation")
public class GitOperationPlugin extends Plugin {

    public static boolean deleteDirectory(File path) {
    // TODO Auto-generated method stub
        if (path.exists()) {
            File[] files = path.listFiles();
            for (int i=0; i<files.length; i++) {
                if (files[i].isDirectory()) {
                    deleteDirectory(files[i]);
                }
                else {
                    files[i].delete();
                }
            }
        }
        return(path.delete());
    }
    private String getAppRootDir() {
        String iconsStoragePath = getContext().getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS) + "/EffectNote";
        File sdIconStorageDir = new File(iconsStoragePath);
        if(!sdIconStorageDir.exists()){
            sdIconStorageDir.mkdirs();
        }
        return sdIconStorageDir.getAbsolutePath();
    }

    private String getWorkspaceDir(String workspace) {
        return getAppRootDir() + "/" + workspace;
    }

    private String getWholePath(String workspace, String path) {
        return getAppRootDir() + "/" + workspace + "/" + path;
    }

    private Integer getCommitNum(Git git) throws IOException, GitAPIException {
        Integer count = 0;
        Iterable<RevCommit> commits = git.log().all().call();
        for (RevCommit commit : commits) {
//            System.out.println("LogCommit: " + commit);
            count++;
        }
        return count;
    }

    private static void createCommit(Git git, String fileName) throws GitAPIException {
        // run the add
        git.add()
            .addFilepattern(fileName)
            .call();
        android.text.format.DateFormat df = new android.text.format.DateFormat();
        String message = df.format("yyyy-MM-dd hh:mm:ss", new java.util.Date()).toString() + "(by android)";
        // and then commit the changes
        RevCommit revCommit = git.commit()
                .setMessage(message)
                .call();
    }

    private static List<String> readElementsAt(Repository repository, String commit, String path) throws IOException {
        RevCommit revCommit = buildRevCommit(repository, commit);

        // and using commit's tree find the path
        RevTree tree = revCommit.getTree();
        //System.out.println("Having tree: " + tree + " for commit " + commit);

        List<String> items = new ArrayList<>();

        // shortcut for root-path
        if (path.isEmpty()) {
            try (TreeWalk treeWalk = new TreeWalk(repository)) {
                treeWalk.addTree(tree);
                treeWalk.setRecursive(true);
                treeWalk.setPostOrderTraversal(false);

                while (treeWalk.next()) {
                    items.add(treeWalk.getPathString());
                }
            }
        } else {
            // now try to find a specific file
            try (TreeWalk treeWalk = buildTreeWalk(repository, tree, path)) {
                if ((treeWalk.getFileMode(0).getBits() & FileMode.TYPE_TREE) == 0) {
                    throw new IllegalStateException("Tried to read the elements of a non-tree for commit '" + commit + "' and path '" + path + "', had filemode " + treeWalk.getFileMode(0).getBits());
                }

                try (TreeWalk dirWalk = new TreeWalk(repository)) {
                    dirWalk.addTree(treeWalk.getObjectId(0));
                    dirWalk.setRecursive(false);
                    while (dirWalk.next()) {
                        items.add(dirWalk.getPathString());
                    }
                }
            }
        }

        return items;
    }

    private static RevCommit buildRevCommit(Repository repository, String commit) throws IOException {
        // a RevWalk allows to walk over commits based on some filtering that is defined
        try (RevWalk revWalk = new RevWalk(repository)) {
            return revWalk.parseCommit(ObjectId.fromString(commit));
        }
    }

    private static TreeWalk buildTreeWalk(Repository repository, RevTree tree, final String path) throws IOException {
        TreeWalk treeWalk = TreeWalk.forPath(repository, path, tree);

        if(treeWalk == null) {
            throw new FileNotFoundException("Did not find expected file '" + path + "' in tree '" + tree.getName() + "'");
        }

        return treeWalk;
    }

    private String getContentOfGitHead(String workspace, String path) throws IOException {
        Repository existingRepo = new FileRepositoryBuilder()
                .setGitDir(new File(getWorkspaceDir(workspace) + "/.git"))
                .build();
        final ObjectId oid = existingRepo.resolve(Constants.HEAD);
        RevCommit commit = buildRevCommit(existingRepo, oid.getName());
        RevTree tree = commit.getTree();
        TreeWalk treeWalk = new TreeWalk(existingRepo);
        treeWalk.addTree(tree);
        treeWalk.setRecursive(true);
        treeWalk.setFilter(PathFilter.create(path));
        if (!treeWalk.next()) {
            throw new IllegalStateException(String.format("Did not find expected file %s", path));
        }
        ObjectId objectId = treeWalk.getObjectId(0);
        ObjectLoader loader = existingRepo.open(objectId);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        loader.copyTo(baos);
        return baos.toString();
    }
    @PluginMethod
    public void gitClone(PluginCall call) {
        String gitLocalDir = call.getString("gitLocalDir", "default");
        String gitRemote = call.getString("gitRemote");
        String gitUsername = call.getString("gitUsername");
        String gitPassword = call.getString("gitPassword");
        File workspaceDir = new File(getWorkspaceDir(gitLocalDir));
        try {
            if (workspaceDir.exists()) {
                deleteDirectory(workspaceDir);
            }
            Git.cloneRepository()
                     .setURI(gitRemote)
                     .setDirectory(workspaceDir)
                     .setCredentialsProvider(new UsernamePasswordCredentialsProvider(gitUsername, gitPassword))
                     .call();
            SharedPreferences preferences = getContext().getSharedPreferences("EffectNote", Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = preferences.edit();
            editor.putString(String.format("%s:gitUsername", gitLocalDir), gitUsername);
            editor.putString(String.format("%s:gitPassword", gitLocalDir), gitPassword);
            editor.apply();
            call.resolve();
        } catch (Exception e) {
            Log.e("GitOperationPlugin", "gitClone: failed", e);
            call.reject("failed");
        }
    }

    @PluginMethod
    public void gitPull(PluginCall call) {
        String workspace = call.getString("workspace");
        SharedPreferences preferences = getContext().getSharedPreferences("EffectNote", Context.MODE_PRIVATE);
        String gitUsername = preferences.getString(String.format("%s:gitUsername", workspace), "");
        String gitPassword = preferences.getString(String.format("%s:gitPassword", workspace), "");
        try {
            Git git = Git.open(new File(getWorkspaceDir(workspace)));
            Integer commitsNumAfterUpdate = getCommitNum(git);
            git.pull()
                    .setCredentialsProvider(new UsernamePasswordCredentialsProvider(gitUsername, gitPassword))
                    .call();
            JSObject ret = new JSObject();
            ret.put("data", getCommitNum(git) - commitsNumAfterUpdate);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e("GitOperationPlugin", "gitPull: failed", e);
            call.reject("failed");
        }
    }
    @PluginMethod
    public void updateContent(PluginCall call) {
        String workspace = call.getString("workspace");
        String path = call.getString("path");
        String content = call.getString("content");
        SharedPreferences preferences = getContext().getSharedPreferences("EffectNote", Context.MODE_PRIVATE);
        String gitUsername = preferences.getString(String.format("%s:gitUsername", workspace), "");
        String gitPassword = preferences.getString(String.format("%s:gitPassword", workspace), "");
        try {
            String oldContent = getContentOfGitHead(workspace, path);
            if (content.equals(oldContent)) {
                Log.i("GitOperationPlugin", "all the same, no need to push");
                call.resolve();
            } else {
                OutputStreamWriter outputStreamWriter = new OutputStreamWriter(new FileOutputStream(getWholePath(workspace, path)));
                outputStreamWriter.write(content);
                outputStreamWriter.close();
                Git git = Git.open(new File(getWorkspaceDir(workspace)));
                createCommit(git, path);
                git.push()
                    .setCredentialsProvider(new UsernamePasswordCredentialsProvider(gitUsername, gitPassword))
                    .call();
                call.resolve();
            }
        } catch (Exception e) {
            Log.e("GitOperationPlugin", "updateContent: failed", e);
            call.reject("save failed");
        }
    }
    @PluginMethod
    public void listFiles(PluginCall call) {
        String workspace = call.getString("workspace");
        Repository existingRepo = null;
        try {
            existingRepo = new FileRepositoryBuilder()
                    .setGitDir(new File(getWorkspaceDir(workspace) + "/.git"))
                    .build();
            final ObjectId oid = existingRepo.resolve(Constants.HEAD);
            JSObject ret = new JSObject();
            JSArray paths = new JSArray(readElementsAt(existingRepo, oid.getName(), ""));
            ret.put("data", paths);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e("GitOperationPlugin", "listFiles: failed", e);
            call.reject("failed");
        }
    }

    @PluginMethod
    public void blobContent(PluginCall call) {
        String workspace = call.getString("workspace");
        String path = call.getString("path");
        try {
            JSObject ret = new JSObject();
            ret.put("data", getContentOfGitHead(workspace, path));
            call.resolve(ret);
        } catch (Exception e) {
            Log.e("GitOperationPlugin", "blobContent: failed", e);
            call.reject("failed");
        }
    }
}
