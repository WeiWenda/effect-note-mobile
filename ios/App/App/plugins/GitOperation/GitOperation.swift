//
//  GitOperation.swift
//  App
//
//  Created by Mac on 2023/11/20.
//

import Foundation
import UIKit
import ObjectiveGit

public class GitOperation: NSObject {
    
  public func gitClone(gitLocalDir: String,
                       gitRemote: String,
                       gitUsername: String,
                       gitPassword: String,
                       completion: @escaping () -> Void) {
    DispatchQueue.main.async {
      let auth = GTCredentialProvider { (type, url, username) -> GTCredential? in
        let cred = try? GTCredential(userName: gitUsername, password: gitPassword)
        return cred
      }
      var options = [String : Any]()
      options[GTRepositoryCloneOptionsCredentialProvider] = auth
      options[GTRepositoryRemoteOptionsCredentialProvider] = auth
      let remoteURL = URL(string: gitRemote);
//      let documentPath = NSSearchPathForDirectoriesInDomains(.documentationDirectory,.userDomainMask,true)[0]
      let documentPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let filePath = documentPath.absoluteString.replacingOccurrences(of: "file://", with: "") + gitLocalDir
      NSLog("gitClone documentPath: %@", documentPath.absoluteString)
      let localDir = documentPath.appendingPathComponent(gitLocalDir);
      do {
        if (FileManager.default.fileExists(atPath: filePath)) {
          try FileManager.default.removeItem(at: localDir)
        }
        try GTRepository.clone(from: remoteURL!, toWorkingDirectory: localDir, options: options);
        UserDefaults.standard.set(gitUsername, forKey: "\(gitLocalDir):gitUsername")
        UserDefaults.standard.set(gitPassword, forKey: "\(gitLocalDir):gitPassword")
        completion()
      } catch {
        print(error)
      }
    }
  }
  
  public func listFiles(workspace: String) -> [String] {
    do {
      let documentPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      NSLog("gitClone documentPath: %@", documentPath.absoluteString)
      let localDir = documentPath.appendingPathComponent(workspace)
      let repo = try GTRepository.init(url: localDir)
      let index = try repo.index()
      return index.entries.map { indexEntry in
        indexEntry.path
      }
    } catch {
      print(error)
      return []
    }
  }
  
  public func blobContent(workspace: String, path: String) -> String? {
    do {
      let documentPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let localDir = documentPath.appendingPathComponent(workspace)
      let repo = try GTRepository.init(url: localDir)
      let index = try repo.index()
      let indexEntry = index.entry(withPath: path)
      let blob = try repo.lookUpObject(by: indexEntry!.oid) as! GTBlob
      return blob.content() ?? ""
    } catch {
      print(error)
      return nil
    }
  }
  
  public func saveContent(workspace: String, path: String, content: String) -> Int {
    do {
      let documentPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let localDir = documentPath.appendingPathComponent(workspace)
      let repo = try GTRepository.init(url: localDir)
      let index = try repo.index()
      let indexEntry = index.entry(withPath: path)
      let blob = try repo.lookUpObject(by: indexEntry!.oid) as! GTBlob
      let oldContent = blob.content() ?? ""
      if (oldContent != content) {
        let actualPath = localDir.appendingPathComponent(path)
        let stringData = content.data(using: .utf8)
        try stringData!.write(to: actualPath)
        return 1
      } else {
        NSLog("all the same, no need to push")
        return 0
      }
    } catch {
      print(error)
      return -1
    }
  }
  
  public func gitPull(workspace: String) -> UInt {
    do {
      let gitUsername = UserDefaults.standard.string(forKey: "\(workspace):gitUsername")
      let gitPassword = UserDefaults.standard.string(forKey: "\(workspace):gitPassword")
      let auth = GTCredentialProvider { (type, url, username) -> GTCredential? in
        let cred = try? GTCredential(userName: gitUsername ?? "", password: gitPassword ?? "")
        return cred
      }
      var options = [String : Any]()
      options[GTRepositoryCloneOptionsCredentialProvider] = auth
      options[GTRepositoryRemoteOptionsCredentialProvider] = auth
      let documentPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let localDir = documentPath.appendingPathComponent(workspace)
      let repo = try GTRepository.init(url: localDir)
      var error : NSError?
      let commitsNum = repo.numberOfCommits(inCurrentBranch: &error);
      if (error != nil) {
        throw error!;
      }
      let defaultBranch = try repo.currentBranch()
      let remoteName = try repo.remoteNames().first;
      let defaultRemote = try GTRemote(name: remoteName ?? "origin", in: repo)
      try repo.pull(defaultBranch, from: defaultRemote, withOptions: options)
      let commitsNumAfterUpdate = repo.numberOfCommits(inCurrentBranch: &error);
      if (error != nil) {
        throw error!;
      }
      return commitsNumAfterUpdate - commitsNum;
    } catch {
      print(error)
      return 0
    }
  }
  
  public func gitPush(workspace: String,
                      completion: @escaping () -> Void) {
    do {
      let gitUsername = UserDefaults.standard.string(forKey: "\(workspace):gitUsername")
      let gitPassword = UserDefaults.standard.string(forKey: "\(workspace):gitPassword")
      let auth = GTCredentialProvider { (type, url, username) -> GTCredential? in
        let cred = try? GTCredential(userName: gitUsername ?? "", password: gitPassword ?? "")
        return cred
      }
      var options = [String : Any]()
      options[GTRepositoryCloneOptionsCredentialProvider] = auth
      options[GTRepositoryRemoteOptionsCredentialProvider] = auth
      let documentPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      NSLog("gitPush documentPath: %@", documentPath.absoluteString)
      let localDir = documentPath.appendingPathComponent(workspace)
      let repo = try GTRepository.init(url: localDir)
      let index = try repo.index()
      try index.addAll()
      try index.write()
      let formatter = DateFormatter()
      formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
      let message = formatter.string(for: Date())! + "(by ios)"
      let tree = try index.writeTree()
      let defaultBranch = try repo.currentBranch()
      let commit = try defaultBranch.targetCommit()
      try repo.createCommit(with: tree, message: message, parents: [commit], updatingReferenceNamed: "HEAD")
      let remoteName = try repo.remoteNames().first;
      let defaultRemote = try GTRemote(name: remoteName ?? "origin", in: repo)
      try repo.push(defaultBranch, to: defaultRemote, withOptions: options)
      return completion()
    } catch {
      print(error)
      completion()
    }
  }
  

}
