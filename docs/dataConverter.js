var csTypeNames = {
    'boolean': 'bool',
    'byte': 'byte',
    'short': 'short',
    'long': 'int',
    'long long': 'long',
    'double': 'double',
    'unsigned short': 'ushort',
    'unsigned long': 'uint',
    'unsigned long long': 'ulong',
    'float': 'float',
    'unrestricted float': 'float',
    'double': 'double',
    'unrestricted double': 'double',
    'domstring': 'string',
    'usvstring': 'string',
    'object': 'object',
    'void': 'void',
    'arraybuffer': 'byte',
    'arraybufferview': 'byte',
    'domhighRestimestamp': 'TimeSpan',
    'domtimestamp': 'TimeSpan',
    'octet': 'byte',
    'blob': 'FileInfo',
    'record': 'dictionary'
};

var primitiveTypes = [
    'void',
    'bool',
    'byte',
    'sbyte',
    'short',
    'ushort',
    'int',
    'uint',
    'long',
    'ulong',
    'float',
    'double',
    'string'
];

function convertToCSType(data, types) {
    var csTypes = [];
    types.forEach(type => {
        var csType = {};
        csType.typeName = type.typeName;
        if(csType.typeName.endsWith('?')) {
           csType.typeName = csType.typeName.substr(0, type.typeName.length - 1);
           csType.nullable = true; 
        }
        csType.typeName = csTypeNames[csType.typeName.toLowerCase()] || csType.typeName;
        if(type.sequence) csType.array = true;
        if(primitiveTypes.includes(csType.typeName)) csType.primitive = true;
        if(csType.typeName === 'string' && csType.array) csType.primitive = false; 
        csType.proxyType = csType.primitive ? csType.typeName : 'string';
        csTypes.push(csType);
    });
    data.csType = csTypes;
}

function generateParamPattern(data, params) {
    if(params.forEach) {
        params.forEach(param => {
            convertToCSType(param, param.type);
        });
    } else {
        convertToCSData()
    }
}

function convertToCSData(data) {
    if(typeof data !== 'object') return;
    Object.keys(data).forEach(key => {
        if(key === 'data_type') {
            convertToCSType(data, data[key]);
        }
        convertToCSData(data[key]);
    });
}