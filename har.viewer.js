/* See license.txt for terms of usage */

HAR.ns(function() { with (Domplate) { with (HAR.Lib) {

//-----------------------------------------------------------------------------

// TODO:
// 5) There should be a clean button to remove all current data (like a page reload).
// 6) the ant build should support testBuild target that doesn't compress
//    har files so, it's easier to debug problems with the release.
// 7) "@VERSION@" and other properties could be possible to use even 
//    in javascript files (currently it's only index.php).
// 8) //#ifdef _DEBUG should be possible to use in all javascript files.
// 10) Cache tab could display even the image. See HAR.Rep.EntryBody.hideCache.

/**
 * HAR Viewer implementation. This object represents the main page content.
 */
HAR.Viewer = domplate(
{
    tabView: null,

    initialize: function()
    {
        var content = HAR.$("content");

        // Reneder page content and select the Input tab by default.
        this.tabView = this.TabView.tag.replace({}, content, this.TabView);
        this.selectTabByName("Input");

        // The URL can specify default file with input data.
        // http://domain/har/viewer?path=<local-file-path>
        var filePath = getURLParameter("example");
        if (!filePath)
            filePath = getURLParameter("path");

        if (filePath)
            this.loadLocalArchive(filePath);

        // Load input date (using JSONP) from remote location.
        // http://domain/har/viewer?inputUrl=<remote-file-url>&callback=<name-of-the-callback>
        var inputUrl = getURLParameter("inputUrl");
        var callback = getURLParameter("callback");
        if (inputUrl)
            this.loadRemoteArchive(inputUrl, callback);

        // Viewer is initialized so, notify all listeners. This is helpful
        // for extending the page using e.g. Firefox extensions.
        fireEvent(content, "onViewerInit");

        HAR.log("har; Viewer initialized.", schema);
    },

    selectTabByName: function(tabName)
    {
        this.TabView.selectTabByName(this.tabView, tabName);
    },

    onAppendPreview: function()
    {
        HAR.log("har; onAppendPreview");

        var docNode = document.documentElement;
        var jsonString = HAR.$("sourceEditor").value;
        var validate = HAR.$("validate").checked; 
        var tabPreviewBody = getElementByClass(docNode, "tabPreviewBody");

        // Parse and validate.
        var inputData = HAR.Rep.Schema.parseInputData(jsonString, tabPreviewBody, validate);
        if (inputData)
        {
            // Append new data into the Preview tab. This is optimalization so,
            // the view doesn't have to be entirely refreshed.
            HAR.Tab.Preview.append(inputData, tabPreviewBody);

            // DOM tab must be regenerated
            var tabDOMBody = getElementByClass(docNode, "tabDOMBody");
            tabDOMBody.updated = false;
        }

        // Switch to the Preview tab.
        HAR.Viewer.selectTabByName("Preview");
    },

    loadLocalArchive: function(filePath)
    {
        HAR.log("har; loadLocalArchive " + filePath);

        var editor = HAR.$("sourceEditor");
        editor.value = "Loading...";

        // Execute XHR to get a local file (the same domain).
        dojo.xhrGet({
            url: filePath,
            handleAs: "text",

            load: function(response, ioArgs)
            {
                // Put loaded JSON into the text box and fire fake onchange event.
                editor.value = response;
                HAR.Viewer.onSourceChange();

                // Press the Preview button.
                HAR.Viewer.onAppendPreview();
            },

            error: function(response, ioArgs)
            {
                HAR.log("har; loadLocalArchive ERROR " + response);
                editor.value = response;
            }
        });
    },

    loadRemoteArchive: function(url, callbackName)
    {
        HAR.log("har; loadRemoteArchive: " + url + ", " + callbackName);

        if (!callbackName)
            callbackName = "onInputData";

        var editor = HAR.$("sourceEditor");
        editor.value = "Loading...";

        var head = document.getElementsByTagName("head")[0];
        var script = document.createElement("script");
        script.src = url;

        // xxxHonza: delete window[propName] throws an exception.
        window[callbackName] = new Function(
            "HAR.Viewer.onRemoteArchiveLoaded.apply(HAR.Viewer, arguments);" +
            "if (!dojo.isIE) delete window[" + callbackName + "];");

        // Attach handlers for all browsers
        var done = false;
        script.onload = script.onreadystatechange = function()
        {
            if (!done && (!this.readyState || 
                this.readyState == "loaded" || 
                this.readyState == "complete"))
            {
                done = true;
                head.removeChild(script);
                HAR.log("har; Remote archive loaded: " + url);
            }
        };
        head.appendChild(script);
    },

    onRemoteArchiveLoaded: function(data)
    {
        HAR.log("har; HAR.Viewer.onRemoteArchiveLoaded");

        var editor = HAR.$("sourceEditor");
        editor.value = dojo.toJson(data, true);

        this.onSourceChange();
        this.onAppendPreview();
    },

    onValidationChange: function()
    {
        var docNode = document.documentElement;

        var tabPreviewBody = getElementByClass(docNode, "tabPreviewBody");
        tabPreviewBody.updated = false;

        var tabDOMBody = getElementByClass(docNode, "tabDOMBody");
        tabDOMBody.updated = false;

        HAR.Model.setData(null);
    },

    onSourceChange: function()
    {
        HAR.log("har; onSourceChange.");
        this.onValidationChange();
    }
});

//-----------------------------------------------------------------------------

/**
 * Domplate template for the main tabbed UI.
 */
HAR.Viewer.TabView = domplate(HAR.Rep.TabView,
{
    tabList:
        DIV({"class": "tabViewBody"},
            DIV({"class": "tabBar"},
                A({"class": "InputTab tab", onmousedown: "$onClickTab", view: "Input"},
                    $STR("viewer.tab.Input")
                ),
                A({"class": "PreviewTab tab", onmousedown: "$onClickTab", view: "Preview"},
                    $STR("viewer.tab.Preview")
                ),
                A({"class": "DOMTab tab", onmousedown: "$onClickTab", view: "DOM"},
                    $STR("viewer.tab.DOM")
                ),
                A({"class": "HelpTab tab", onmousedown: "$onClickTab", view: "Help"},
                    $STR("viewer.tab.About"),
                    "&nbsp;",
                    SPAN({"style": "font-size:11px;color:#DD467B;"},
                        "$version"
                    )
                ),
                A({"class": "SchemaTab tab", onclick: "$onClickTab", view: "Schema"},
                    $STR("viewer.tab.Schema")
                )
            ),
            DIV({"class": "tabInputBody tabBody"}),
            DIV({"class": "tabPreviewBody tabBody"}),
            DIV({"class": "tabDOMBody tabBody"}),
            DIV({"class": "tabHelpBody tabBody"}),
            DIV({"class": "tabSchemaBody tabBody"},
                PRE({"class": "schemaPreview"})
            )
        ),

    version: HAR.getVersion(),

    updateTabBody: function(viewBody, view, object)
    {
        var tab = viewBody.selectedTab;

        var tabInputBody = getElementByClass(viewBody, "tabInputBody");
        if (hasClass(tab, "InputTab") && !tabInputBody.updated)
        {
            tabInputBody.updated = true;

            var template = HAR.$("InputTabTemplate");
            tabInputBody.innerHTML = template.innerHTML;
            //eraseNode(template.innerHTML);
        }

        // If PreviewTab or DOMTab are selected we have to make sure the 
        // JSON input data are parsed and validated.
        var inputData = HAR.Model.inputData; 
        if (!inputData && (hasClass(tab, "PreviewTab") || hasClass(tab, "DOMTab")))
        {
            var view = tab.getAttribute("view");
            var tabBody = getElementByClass(viewBody, "tab" + view + "Body");

            // Don't validate for the DOMTab so, it's easier to explore problems.
            var validate = HAR.$("validate").checked && !hasClass(tab, "DOMTab"); 

            // Don't update PreviewTab and DOMTab if the parsing or validation failed.
            var jsonString = HAR.$("sourceEditor").value;
            inputData = HAR.Rep.Schema.parseInputData(jsonString, tabBody, validate);
            if (!inputData)
                return;

            HAR.Model.setData(inputData);
        }

        var tabPreviewBody = getElementByClass(viewBody, "tabPreviewBody");
        if (hasClass(tab, "PreviewTab") && !tabPreviewBody.updated)
        {
            tabPreviewBody.updated = true;

            // If the source has been changed, render content of the Preview tab.
            // Don't append, just render what is in the sourve editor.
            HAR.Tab.Preview.render(HAR.Model.inputData, tabPreviewBody);
        }

        var tabDOMBody = getElementByClass(viewBody, "tabDOMBody");
        if (hasClass(tab, "DOMTab") && !tabDOMBody.updated)
        {
            tabDOMBody.updated = true;

            // Render DOM tab content. Use parsed input data above or 
            // data coming from the model. Model can be empty if there is 
            // validation error, but the inputData above should be initialized
            // (not validated) in case of the Dom tab.  
            inputData = inputData || HAR.Model.inputData;
            HAR.Tab.DomView.render(inputData, tabDOMBody);
        }

        var tabSchemaBody = getElementByClass(viewBody, "tabSchemaBody");
        if (hasClass(tab, "SchemaTab") && !tabSchemaBody.updated)
        {
            tabSchemaBody.updated = true;

            dojo.xhrGet({
                url: "schema.js",
                load: function(response, ioArgs)
                {
                    dojo.require("dojox.highlight");
                    dojo.require("dojox.highlight.languages.javascript");

                    var code = dojox.highlight.processString(response).result;

                    // xxxHonza: IE doesn't properly preserve whitespaces.
                    if (dojo.isIE)
                        code = code.replace(/\n/g, "<br/>");

                    dojo.attr(tabSchemaBody.firstChild, {innerHTML: code});
                }
            });
        }

        var tabHelpBody = getElementByClass(viewBody, "tabHelpBody");
        if (hasClass(tab, "HelpTab") && !tabHelpBody.updated)
        {
            tabHelpBody.updated = true;

            var template = HAR.$("HelpTabTemplate");
            tabHelpBody.innerHTML = template.innerHTML;
            //eraseNode(template);
        }
    }
});

//-----------------------------------------------------------------------------
}}});