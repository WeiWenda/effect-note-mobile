//
//  GitOperationPlugin.m
//  App
//
//  Created by Mac on 2023/11/20.
//

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(GitOperationPlugin, "GitOperation",
  CAP_PLUGIN_METHOD(listFiles, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(blobContent, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(updateContent, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(gitClone, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(gitPull, CAPPluginReturnPromise);
)

