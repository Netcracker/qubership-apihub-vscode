# Qubership APIHUB Extension
1. [Overview](#overview)
2. [Usage](#usage)
    - [OpenAPI specifications with remote references](#openapi-specifications-with-remote-references)
3. [Configuration file](#configuration-file)

## Overview
Qubership APIHUB extension allows you to publish your API specifications or other API-related documents from a Git reposiotry to [APIHUB](https://github.com/Netcracker/qubership-apihub-ui).

## Usage
After installing the extension, open Git repository and navigate to Qubership APIHUB extention, which is shown in the activity bar. If your repository has at least one OpenAPI or GraphQL specifications, you will see them in the "documents to publish" section.  
***Notes:*** 
1. OpenAPI specification is file that meets one of the following conditions:
   -  ```.yaml```/```.yml``` file that has "openapi" entrance
   -  ```.json``` file that has "openapi" entrance
2. GraphQL specification is file that meets one of the following conditions:
   - ```.graphql```/```.gql``` file

Select the files that you need to publish. If you need to publish files other than OpenAPI or GraphQL specifications, you can extend list of files for publications via [configuration file](#configuration-file). 	

Along with file selection, specify the following information:
1. APIHUB environment:
    * **APIHUB URL** - URL to APIHUB server where you will publish documents.
    * **Authentication Token** - your personal access token issued in APIHUB.
3. Publish to APIHUB:
    * **Package Id** - package where you need to publish your files.
    * **Version** - version of the package.
    * **Status** - status of the package version.
    * **Labels** - any additional information, multiple values can be specified.
    * **Previous Release Version** - previos version for the being published version.

After selecting the files and filling in all the required fields, click the **Publish** button. The status bar will indicate the progress of the publication, and once it is complete, a notification will be displayed.

![](/docs/img/qubership_apihub_extension.png)

### OpenAPI specifications with remote references
OpenAPI allows you to [reference resource definitions](https://swagger.io/docs/specification/v3_0/using-ref/) using the $ref keyword. These references can be either local or remote.  
If your OpenAPI specification includes remote references, you only need to select the main OpenAPI specification file in the extension — there is no need to select the referenced files. During publication, the extension will automatically locate all referenced files (if available in the current open repository), and APIHUB will use them to convert remote references into local ones. As a result, in APIHUB Portal, you will see only the OpenAPI specification with resolved references, but the separate files containing referenced resource definitions will not be visible.  
If you directly select the referenced file with the resource definition along with the main OpenAPI specification file in the extension, APIHUB will process the OpenAPI specification file in the same way. However, in addition, the referenced file will appear as a separate artifact in the APIHUB Portal.

## Configuration file
Configuration file is file where APIHUB extension stores publication-related information. It is ```yaml``` file named ```.apihub-config.yaml```, located in the root of the repository.  
Configuration file contains the following information:

| Field     | Type             | Description    |
| --------- | ---------------- | -------------- |
| version   | string           | Version of configuration file. Currently, only version "1.0" is avaialable. |
| packageId | string           | Package where files will be published.|
| files     | [string]         | List of files that will be published. You can add path to any file from your repository. Such file will be added to the "document to publish" section of the extension.|  

Example of configuration file:
```yaml
version: 1.0
packageId: WS.GRP.PCKG1
files: 
    - src/docs/pet.yaml
    - src/docs/shop.graphql
    - scr/docs/readMe.md
```
The configuration file is automatically created after your first publication. It stores packageId of published version and list of files (paths to the files) that were published. The next time you use the extension, these documents will be pre-selected and the package id will be pre-filled in the extension.

If your open Git repository does not have a configuration file but you need to extend the list of files to publish, you can manually create it following the specified format.
