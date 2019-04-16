

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

import {
  Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit,
  Output, ViewEncapsulation
} from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { UtilsService } from '../../services/utils.service';
import { UssCrudService } from '../../services/uss.crud.service';
import { PersistentDataService } from '../../services/persistentData.service';
/*import { ComponentClass } from '../../../../../../zlux-platform/interface/src/registry/classes';
import { FileBrowserFileSelectedEvent, IFileBrowserUSS }
  from '../../../../../../zlux-platform/interface/src/registry/component-classes/file-browser';
import { Capability, FileBrowserCapabilities }
  from '../../../../../../zlux-platform/interface/src/registry/capabilities';*/
//Commented out to fix compilation errors from zlux-platform changes, does not affect program
//TODO: Implement new capabilities from zlux-platform
import { FileContents } from '../../structures/filecontents';
import { UssDataObject } from '../../structures/persistantdata';
import { TreeNode } from 'primeng/primeng';
import 'rxjs/add/operator/toPromise';

@Component({
  selector: 'file-browser-uss',
  templateUrl: './filebrowseruss.component.html',
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./filebrowseruss.component.css'],
  providers: [UssCrudService, PersistentDataService]
})

export class FileBrowserUSSComponent implements OnInit, OnDestroy {//IFileBrowserUSS,
  //componentClass: ComponentClass;
  //fileSelected: Subject<FileBrowserFileSelectedEvent>;
  //capabilities: Array<Capability>;
  path: string;
  isFile: boolean;
  errorMessage: String;
  rtClickDisplay: boolean;
  addFileDisplay: boolean;
  addFolderDisplay: boolean;
  copyDisplay: boolean;
  renameDisplay: boolean;
  selectedItem: string;
  input_box: string;
  root: string;
  newPath: string;
  popUpMenuX: number;
  popUpMenuY: number;
  selectedFile: TreeNode;

  //TODO:define interface types for uss-data/data
  data: TreeNode[];
  dataObject: UssDataObject;
  ussData: Observable<any>;
  intervalId: any;
  timeVar: number = 10000;//time represents in ms how fast tree updates changes from mainframe

  constructor(private elementRef: ElementRef, private ussSrv: UssCrudService,
    private utils: UtilsService, private persistanceDataService: PersistentDataService) {
    //this.componentClass = ComponentClass.FileBrowser;
    this.initalizeCapabilities();
    this.rtClickDisplay = false;
    this.addFileDisplay = false;
    this.addFolderDisplay = false;
    this.copyDisplay = false;
    this.renameDisplay = false;
    this.root = ""; // Dev purposes: Replace with home directory to test Explorer functionalities
    this.input_box = this.root;
    this.data = [];
  }
  @Output() fileContents: EventEmitter<FileContents> = new EventEmitter<FileContents>();
  @Output() nodeClick: EventEmitter<any> = new EventEmitter<any>();
  //TODO:make or hook up interface for file edits
  @Input()
  set fileEdits(input: any) {
    if (input && input.action && input.action === "save-file") {
      //this.ussSrv.saveFile(input.fileName, input.data)
      this.ussSrv.saveFile(input.fileAddress, input.data)
      .subscribe(
        response =>{
          console.log('no errs')
        },
        error => this.errorMessage = <any>error
      );
    }
  }
  @Input() style: any;
  ngOnInit() {
    this.persistanceDataService.getData()
      .subscribe(data => {
        if (data.contents.ussInput) {
          this.input_box = data.contents.ussInput; }
        if (data.contents.ussData !== undefined)
        data.contents.ussData.length == 0 ? this.displayTree(this.input_box, false) : (this.data = data.contents.ussData, this.input_box = data.contents.ussInput)
        else
        this.displayTree(this.root, false);
      })
      // this.intervalId = setInterval(() => {
      //   this.updateUss(this.input_box);
      // }, this.timeVar);
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  initalizeCapabilities() {
    //this.capabilities = new Array<Capability>();
    //this.capabilities.push(FileBrowserCapabilities.FileBrowser);
    //this.capabilities.push(FileBrowserCapabilities.FileBrowserUSS);
  }

  getSelectedPath(): string {
    //TODO:how do we want to want to handle caching vs message to app to open said path
    return this.path;
  }

  browsePath(path: string): void {
    this.path = path;
  }

  getDOMElement(): HTMLElement {
    return this.elementRef.nativeElement;
  }

  /*getCapabilities(): Capability[] {
    return this.capabilities;
  }*/
  private openFile(fileAddress: string, fileName: string) {
    let currfileContents = this.ussSrv.getFileContents(fileAddress);
    currfileContents.subscribe(
      response => {
        //TODO:need to reconsider breaking this up?
        //TODO:chunked get request doesn't exist, yet, could be problematic for large files
        let lines: Array<string> = response._body.split(/\n/);
        let outfile: FileContents = { filePath: fileAddress, fileName: fileName, fileContents: lines };
        this.fileContents.emit(outfile);
      },
      error => this.errorMessage = <any>error
    );
  }

  onRightClick($event: any): void {
    this.rtClickDisplay = !this.rtClickDisplay;
    this.popUpMenuX = $event.clientX;
    this.popUpMenuY = $event.clientY;
    this.selectedItem = this.input_box + '/' + $event.target.innerText;
    this.isFile = this.utils.isfile(this.checkPath(this.selectedItem), this.data);
  }

  onClick($event: any): void {
    this.rtClickDisplay = false;
  }

  onNodeClick($event: any): void {
    this.rtClickDisplay = false;
    this.input_box = this.input_box.replace(/\/$/, '');
    if ($event.node.data === 'Folder') {
      this.addChild($event.node.path, $event);
      this.nodeClick.emit($event.node);
    }
    else {
      let fileFolder = $event.node.path;
      this.nodeClick.emit($event.node);
      //this.openFile(fileFolder, $event.node.label);
    }
  }

  //Displays the starting file structure of 'path'
  private displayTree(path: string, update: boolean): void {
    if (path === undefined || path == '') {
      path = this.root; 
    }
    this.ussData = this.ussSrv.getFile(path); 
    this.ussData.subscribe(
    files => {
    let tempChildren: TreeNode[] = [];
      for (let i: number = 0; i < files.entries.length; i++) {
        if (files.entries[i].directory) {
          files.entries[i].children = [];
          files.entries[i].data = "Folder";
          files.entries[i].collapsedIcon = "fa fa-folder";
          files.entries[i].expandedIcon = "fa fa-folder-open";
        }
        else {
          files.entries[i].items = {};
          files.entries[i].icon = "fa fa-file";
          files.entries[i].data = "File";
        }
        files.entries[i].label = files.entries[i].name;
        files.entries[i].id = i;
        tempChildren.push(files.entries[i]);
      }
      if (update == true) {//Tree is displayed to update existing opened nodes, while maintaining currently opened trees 

        let indexArray: number[];
        let dataArray: TreeNode[];//represents the working TreeNode[] that will eventually be added to tempChildren and make up the tree
        let networkArray: TreeNode[];//represents the TreeNode[] obtained from the uss server, will iteratively replace dataArray as need be
        let parentNode: TreeNode;
        indexArray = [0];
        dataArray = this.data;
        networkArray = tempChildren;
        while (indexArray[indexArray.length-1] <= dataArray.length) 
        {
          //Go back up a layer
          if (indexArray[indexArray.length-1] == dataArray.length)
          {
            indexArray.pop();
            
            if (parentNode !== undefined && parentNode.parent !== undefined)
              {
                parentNode = parentNode.parent;
                dataArray = parentNode.children;
                networkArray = dataArray;

                //TODO: Uncomment code to also update data of children, however this will cause
                //a desync with the async code so you need to add code that waits for the .subscribe(...) method to finish
                //because the loop cannot move onto a children when the parent data are not finished loading from
                
                // this.ussData = this.ussSrv.getFile(parentNode.path);
                // let array: TreeNode[] = [];
                // this.ussData.subscribe(
                //   files => {
                //     for (let i: number = 0; i < files.entries.length; i++) {
                //       if (files.entries[i].directory) {
                //         files.entries[i].children = [];
                //         files.entries[i].data = "Folder";
                //         files.entries[i].collapsedIcon = "fa fa-folder";
                //         files.entries[i].expandedIcon = "fa fa-folder-open";
                //       }
                //       else {
                //         files.entries[i].items = {};
                //         files.entries[i].icon = "fa fa-file";
                //         files.entries[i].data = "File";
                //       }
                //       files.entries[i].label = files.entries[i].name;
                //       files.entries[i].id = i;
                //       array.push(files.entries[i]);

                //     } networkArray = array; },
                //     error => console.log("Error: ", error),
                //    );
                //    console.log(array);
                //    while (array.length == 0)
                //    {
                //      //setTimeout("sleep", 1000);
                //    }

              }
              else{
                if (parentNode !== undefined)
                {
                  for (let i: number = 0; i < tempChildren.length; i++) {
                    if (parentNode.label == tempChildren[i].label || parentNode.children == tempChildren[i].children) {
                      tempChildren[i] = parentNode; break;
                    }
                  }
                }
                
                dataArray = this.data;
                networkArray = tempChildren;
              }
          }
          else if (dataArray[indexArray[indexArray.length-1]] !== undefined && dataArray[indexArray[indexArray.length-1]].data == 'Folder' && dataArray[indexArray[indexArray.length-1]].children !== undefined && dataArray[indexArray[indexArray.length-1]].children.length !== 0)
          {
            //... if the children of dataArray with index in last element of indexArray are not empty, drill into them!
            parentNode = dataArray[indexArray[indexArray.length-1]];
            dataArray = parentNode.children;
            networkArray = dataArray;

            //TODO: Uncomment code to also update data of children, however this will cause
            //a desync with the async code so you need to add code that waits for the .subscribe(...) method to finish
            // this.ussData = this.ussSrv.getFile(parentNode.path);
            // let array: TreeNode[] = [];
            // this.ussData.subscribe(
            //   files => {
                
            //     for (let i: number = 0; i < files.entries.length; i++) {
            //       if (files.entries[i].directory) {
            //         files.entries[i].children = [];
            //         files.entries[i].data = "Folder";
            //         files.entries[i].collapsedIcon = "fa fa-folder";
            //         files.entries[i].expandedIcon = "fa fa-folder-open";
            //       }
            //       else {
            //         files.entries[i].items = {};
            //         files.entries[i].icon = "fa fa-file";
            //         files.entries[i].data = "File";
            //       }
            //       files.entries[i].label = files.entries[i].name;
            //       files.entries[i].id = i;
            //       array.push(files.entries[i]);

            //     } networkArray = array; },
            //     error => console.log("Error: ", error), );
                
            //     console.log(array);
            //     while (array.length == 0)
            //       {
            //         //setTimeout("sleep", 1000);
            //         //createAwait()
            //       }
            
            indexArray[indexArray.length-1]++;
            indexArray.push(0);
          }
          else 
          {
              dataArray[indexArray[indexArray.length-1]] = networkArray[indexArray[indexArray.length-1]];
              indexArray[indexArray.length-1]++;//go up index to check new element in data array
          }
        }
      }

      console.log("Tree has been updated.");
      this.data = tempChildren;  
      this.input_box = path;

      this.persistanceDataService.getData()
            .subscribe(data => {
              this.dataObject = data.contents;
              this.dataObject.ussInput = this.input_box;
              this.dataObject.ussData = this.data;
              this.persistanceDataService.setData(this.dataObject)
                .subscribe((res: any) => { });
            })

        },
        error => this.errorMessage = <any>error
      );

    }

  public sleep(milliseconds) {
      var start = new Date().getTime();
      for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds){
          break;
        }
      }
    }

  //Adds children to the existing this.data TreeNode array to update tree
  addChild(path: string, $event: any): void {
    if (this.selectedFile !== undefined && this.selectedFile.label == $event.node.label && this.selectedFile.children == $event.node.children) 
    {
      let updateTree = false; this.displayTree(path, updateTree);
    } 
    else
    { 
      this.selectedFile = $event.node;
      $event.node.expanded = true;
      this.ussData = this.ussSrv.getFile(path);
      let tempChildren: TreeNode[] = [];
      this.ussData.subscribe(
        files => {
          //TODO: Could be turned into a util service...
          for (let i: number = 0; i < files.entries.length; i++) {
            if (files.entries[i].directory) {
              files.entries[i].children = [];
              files.entries[i].data = "Folder";
              files.entries[i].collapsedIcon = "fa fa-folder";
              files.entries[i].expandedIcon = "fa fa-folder-open";
            }
            else {
              files.entries[i].items = {};
              files.entries[i].icon = "fa fa-file";
              files.entries[i].data = "File";
            }
            files.entries[i].label = files.entries[i].name;
            files.entries[i].id = i;
            tempChildren.push(files.entries[i]);

          } $event.node.children = tempChildren;
          $event.node.expandedIcon = "fa fa-folder-open"; $event.node.collapsedIcon = "fa fa-folder";
          console.log(path + " was populated with " + tempChildren.length + " children.");

          while ($event.node.parent !== undefined) {
            let newChild = $event.node.parent;
            newChild.children[$event.node.id] = $event.node;
            newChild.expanded = true;
            newChild.expandedIcon = "fa fa-folder-open"; newChild.collapsedIcon = "fa fa-folder";
            $event.node = newChild;
          }

          let index = -1;
          for (let i: number = 0; i < this.data.length; i++) {
            if (this.data[i].label == $event.node.label) {
              index = i; break;
            }
          }
          if (index != -1) {
            this.data[index] = $event.node;
            this.persistanceDataService.getData()
              .subscribe(data => {
                this.dataObject = data.contents;
                this.dataObject.ussInput = this.input_box;
                this.dataObject.ussData = this.data;
                this.persistanceDataService.setData(this.dataObject)
                  .subscribe((res: any) => { });
              })
            
          }
          else
            console.log("failed to find index");
        }); 
    }
  }

  updateUss(path: string): void {
    this.displayTree(path, true);
  }

  addFile(): void {
    console.log('add:' + this.selectedItem);
    this.ussSrv.saveFile(this.checkPath(this.newPath), '')
      .subscribe(
        resp => {
          this.updateUss(this.input_box);
          this.newPath = '';
        },
        error => this.errorMessage = <any>error
      );
  }

  addFolder(): void {
    console.log('add:' + this.selectedItem);
    this.ussSrv.addFolder(this.checkPath(this.newPath))
      .subscribe(
        resp => {
          this.updateUss(this.input_box);
          this.newPath = '';
        },
        error => this.errorMessage = <any>error
      );
  }

  copy(): void {
    console.log('copy:' + this.selectedItem);
    this.ussSrv.copyFile(this.selectedItem, this.checkPath(this.newPath))
      .subscribe(
        resp => {
          this.updateUss(this.input_box);
        },
        error => this.errorMessage = <any>error
      );
  }

  rename(): void {
    console.log('rename:' + this.selectedItem);
    this.ussSrv.renameFile(this.selectedItem, this.checkPath(this.newPath))
      .subscribe(
        resp => {
          this.updateUss(this.input_box);
        },
        error => this.errorMessage = <any>error
      );
  }

  delete(e: EventTarget): void {
    console.log('delete:' + this.selectedItem);
    this.ussSrv.deleteFile(this.selectedItem)
      .subscribe(
        resp => {
          this.updateUss(this.input_box);
        },
        error => this.errorMessage = <any>error
      );
  }
  levelUp(): void {
    //TODO: may want to change this to 'root' depending on mainframe file access security
    //to prevent people from accessing files/folders outside their root dir
    if (this.input_box !== "/" && this.input_box !== '') 
    {
      this.input_box = this.input_box.replace(/\/$/, '').replace(/\/[^\/]+$/, '');
      if (this.input_box === '' || this.input_box == '/') {
        this.input_box = '/';
      }

      let parentindex = this.input_box.length - 1;
      while (this.input_box.charAt(parentindex) != '/') { parentindex--; }
      let parent = this.input_box.slice(parentindex + 1, this.input_box.length);
      console.log(parent);

      this.displayTree(this.input_box, false);
    } else
      this.updateUss(this.input_box);
  }
  addFileDialog() {
    this.addFileDisplay = true;
  }
  addFolderDialog() {
    this.addFolderDisplay = true;
  }
  copyDialog() {
    this.copyDisplay = true;
  }
  renameDialog() {
    this.renameDisplay = true;
  }
  private checkPath(input: string): string {
    return this.utils.filePathEndCheck(this.input_box) + input;
  }
}


/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

