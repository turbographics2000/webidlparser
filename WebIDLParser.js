// var knownKindClassNames = [
//     'idlCallback',
//     'idlDictionary',
//     'idlEnum',
//     'idlInterface'
// ];

// var knownClasses = [
//     'idl',
//     'idlAttrName',
//     'idlAttrType',
//     'idlAttribute',
//     'idlCallback',
//     'idlCallbackID',
//     'idlCallbackType',
//     'idlConst',
//     'idlConstName',
//     'idlConstType',
//     'idlConstValue',
//     'idlCtor',
//     'idlCtorName',
//     'idlDefaultValue',
//     'idlDictionary',
//     'idlDictionaryID',
//     'idlEnum',
//     'idlEnumID',
//     'idlEnumItem',
//     'idlImplements',
//     'idlImplementsDesc',
//     'idlInterface',
//     'idlInterfaceID',
//     'idlIterable',
//     'idlMaplike',
//     'idlMaplikeKeyType',
//     'idlMaplikeValueType',
//     'idlMember',
//     'idlMemberName',
//     'idlMemberType',
//     'idlMemberValue',
//     'idlMethName',
//     'idlMethType',
//     'idlMethod',
//     'idlParam',
//     'idlParamName',
//     'idlParamType',
//     'idlParamValue',
//     'idlSectionComment',
//     'idlSerializer',
//     'idlSerializerValues',
//     'idlSuperclass',
//     'idlTitle',
//     'idlType',
//     'idlTypedef',
//     'idlTypedefID',
//     'idlTypedefType',
//     'idlattr',
//     'idlinterface',
//     'idltype',
//     'idlvalue'
// ];

/*
parseData = {
    Dictionary: { groupData
        RTCConfiguration: { groupItemData
            Member: { memberData
                iceServers: { memberItemData
                    type: {
                        sequence: true,
                        typeName: RTCIceServer
                    }
                }
            }
        }
    }
}
*/

function WebIDLParse(doc, optimize) {
    var parseData = {};

    var groups = Array.from(doc.querySelectorAll('.idl *[class$=ID]'))
        .map(elm => elm.className.replace(/^idl(.+?)ID$/, (a, b) => b))
        .filter((val, idx, arr) => arr.indexOf(val) === idx);

    groups.forEach(group => { // Dictionary, Interface, Enum, Callback ...
        var groupData = parseData[group] = parseData[group] || {};
        doc.querySelectorAll(`.idl${group}`).forEach(groupElm => {
            var id = getText(groupElm.querySelector(`.idl${group}ID`));
            var groupItemData = groupData[id] = groupData[id] || {};
            extAttrParse(groupElm, groupItemData);
            var types = typeParse(groupElm.querySelector('.idlMaplike'));
            if (types) {
                parseData.Maplike = parseData.Maplike || {};
                parseData.Maplike[id] = {
                    key: {
                        type: [{ typeName: types[0].typeName[0] }]
                    },
                    value: {
                        type: [{ typeName: types[0].typeName[1] }]
                    }
                };
                return;
            }
            switch (group) {
                case 'Dictionary':
                case 'Interface':
                    var superclass = getText(groupElm.querySelector('.idlSuperclass'));
                    if(superclass) groupItemData.Superclass = superclass;
                    ['Ctor', 'Attribute', 'Member', 'Method', 'Maplike'].forEach(memberKind => {
                        memberParse(groupElm, groupItemData, memberKind);
                    })
                    break;
                case 'Callback':
                    memberParse(groupElm, groupItemData, 'Callback');
                    var cbParams = paramParse(groupElm);
                    if (cbParams) groupItemData.param = cbParams;
                    break;
                case 'Enum':
                    groupElm.querySelectorAll('.idlEnumItem').forEach(item => {
                        groupItemData.items = groupItemData.items || [];
                        groupItemData.items.push(getText(item).replace(/"/g, ''));
                    });
                    break;
            }
        });
    });

    if (optimize) {
        dataOptimize(parseData);
        dataOptimize2(parseData);
    }
    return parseData;
}

function memberParse(groupElm, groupItemData, memberKind) {
    var memberElms = groupElm.querySelectorAll(`.idl${memberKind}`);
    if (memberElms.length) {
        var memberData = null;
        if(memberKind === 'Ctor') {
            memberData = groupItemData[memberKind] = groupItemData[memberKind] || [];
        } else {
            memberData = groupItemData[memberKind] = groupItemData[memberKind] || {};
        }
        memberElms.forEach(elm => {
            memberKind = { Attribute: 'Attr', Method: 'Meth' }[memberKind] || memberKind;
            var memberName = getText(elm.querySelector(`.idl${memberKind}Name`));

            var types = typeParse(elm.querySelector(`.idlType, .idl${memberKind}Type`));
            if (types && types[0].typeName[0] === 'EventHandler') {
                memberData.eventHandler = memberData.eventHandler || [];
                memberData.eventHandler.push(memberName);
                return;
            }

            var memberItemData = null;
            if(memberKind === 'Ctor') {
                memberItemData = {};
            } else {
                memberItemData = memberName ? memberData[memberName] = memberData[memberName] || {} : memberData;
            }
            if (types) memberItemData.type = types;
            var typeDec = /([a-z]+?)<(.+?)>/i.exec(getText(elm));
            var typeDecs = ['frozenarray', 'record', 'sequence'];
            if(elm.className === 'idlAttribute') typeDecs.push('promise');
            if(typeDec && !typeDecs.includes(typeDec[1].toLowerCase())) {
                memberItemData[typeDec[1]] = true;                
            }

            headerKeywordsParse(elm, memberItemData);
            extAttrParse(elm, memberItemData);

            var params = paramParse(elm);
            if (params) {
                memberItemData.param = params;
            }

            var defaultValue = getText(elm.querySelector(`.idl${memberKind}Value`));
            if (defaultValue) {
                memberItemData.defaltValue = defaultValue.replace(/"/g, '');
            }

            if (memberKind === 'Superclass') {
                memberData = getText(elm);
            }

            if(memberKind === 'Ctor') {
                memberData.push(memberItemData);
            }
        });
    }
}

function appendMessage(txt) {
    var div = document.createElement('div');
    div.textContent = txt;
    document.body.appendChild(div);
}

function extAttrParse(target, parseData) {
    var extAttrElms = target.querySelectorAll(':scope > .extAttr');
    var extAttrs = [];
    extAttrElms.forEach(elm => {
        var extAttr = {};
        var name = getText(elm.querySelector('.extAttrName'));
        if (name) extAttr.extAttrName = name;
        var rhs = getText(elm.querySelector('.extAttrRhs'));
        if (rhs) extAttr.extAttrRhs = rhs;
        extAttrs.push(extAttr);
    });
    if (extAttrs.length) parseData.extAttr = extAttrs;
}

var nullObj = { textContent: '' };
function getText(elm) {
    return (elm || nullObj).textContent.trim();
}

function headerKeywordsParse(target, parseData) {
    var keywords = getText(target).split(' ');
    keywords.forEach(keyword => {
        if (keyword === 'static') parseData.static = true;
        if (keyword === 'readonly') parseData.readonly = true;
        if (keyword === 'required') parseData.required = true;
    });
}

function paramParse(target) {
    var params = null;
    target.querySelectorAll('.idlParam').forEach(param => {
        params = params || [];

        var prm = {
            paramName: getText(param.querySelector('.idlParamName')),
            type: typeParse(param.querySelector('.idlParamType'))
        };
        var txt = getText(param);
        if (txt.startsWith('optional ')) {
            prm.optional = true;
        }
        var defaultValue = getText(param.querySelector('.idlMemberValue'));
        if (defaultValue) {
            if (prm.type[0].isPrimitive && prm.type[0].type !== 'string') {
                defaultValue = +defaultValue;
            }
            prm.defaultValue = defaultValue;
        }
        headerKeywordsParse(param, prm);
        params.push(prm);
    });
    return params;
}

function typeParse(typeElm) {
    if (!typeElm) return null;

    var types = [];
    var txt = getText(typeElm);
    txt.replace(/\(|\)|\r|\n/g, '').split(' or ').forEach(typeName => {
        var typeDec = /([a-z]+?)<(.+?)>/i.exec(typeName);
        var type = {};
        if (typeDec) {
            typeDecs = ['frozenarray', 'record', 'sequence'];
            if(typeElm.className === 'idlAttrType') typeDecs.push('promise');
            if(typeDecs.includes(typeDec[1].toLowerCase())) {
                type[typeDec[1]] = true;
            }
            typeName = typeDec[2];
        }
        var typeNames = typeName.split(',').map(x => x.trim());
        if(type.record || type.maplike) {
            type.key = {
                typeName: typeNames[0]
            };
            type.value = {
                typeName: typeNames[1]
            };
        } else {
            type.typeName = typeNames.length > 1 ? typeNames : typeNames[0];
            //type.typeName = typeNames;
        }
        types.push(type);
    });
    return types;
}

function dataOptimize(data) {
    if (typeof data !== 'object') return;
    Object.keys(data).forEach(key => {
        dataOptimize(data[key]);
        if (Array.isArray(data[key]) && data[key].length === 1) {
            data[key] = data[key][0];
        }
    });
}

function dataOptimize2(data) {
    if (typeof data !== 'object') return;
    Object.keys(data).forEach(key => {
        dataOptimize2(data[key]);
        var subKeys = Object.keys(data[key]);
        if (subKeys.length === 1) {
            data[key] = data[key][subKeys[0]];
        }
    });
}
