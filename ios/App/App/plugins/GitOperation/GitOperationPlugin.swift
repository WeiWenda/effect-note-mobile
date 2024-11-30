//
//  GitOperationPlugin.swift
//  App
//
//  Created by Mac on 2023/11/20.
//

import Foundation
import Capacitor

@objc(GitOperationPlugin)
public class GitOperationPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "GitOperationPlugin"
  public let jsName = "GitOperation"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "listFiles", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "blobContent", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "updateContent", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "gitClone", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "gitPull", returnType: CAPPluginReturnPromise),
  ]
    
  private let implementation = GitOperation()
  
  override public func load() {
  }

  deinit {
  }
  
  @objc public func listFiles(_ call: CAPPluginCall) {
    let files = implementation.listFiles(workspace: call.getString("workspace")!);
    call.resolve(["data": files])
  }
  
  @objc public func blobContent(_ call: CAPPluginCall) {
    let content = implementation.blobContent(workspace: call.getString("workspace")!, path: call.getString("path")!);
    if (content != nil) {
      call.resolve(["data": content!])
    } else {
      call.reject("get content failed")
    }
  }
  
  @objc public func updateContent(_ call: CAPPluginCall) {
    let code = implementation.saveContent(
      workspace: call.getString("workspace")!,
      path: call.getString("path")!,
      content: call.getString("content")!);
    if (code == 1) {
      implementation.gitPush(workspace: call.getString("workspace")!) {
        call.resolve()
      };
    } else if (code == -1){
      call.reject("save failed")
    } else {
      call.resolve()
    }
  }
  
  @objc public func gitPull(_ call: CAPPluginCall) {
    let newCommitNum = implementation.gitPull(workspace: call.getString("workspace")!);
    call.resolve(["data": newCommitNum])
  }

  @objc public func gitClone(_ call: CAPPluginCall) {
    implementation.gitClone(gitLocalDir: call.getString("gitLocalDir")!,
                            gitRemote: call.getString("gitRemote")!,
                            gitUsername: call.getString("gitUsername")!,
                            gitPassword: call.getString("gitPassword")!) {
      call.resolve()
    }
  }
  
}
