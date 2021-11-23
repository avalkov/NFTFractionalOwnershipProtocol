const { expect } = require("chai");


function expectArraysEqual(arr, expectedArr) {
    expect(arr.length).to.equal(expectedArr.length);

    for (let i = 0; i < arr.length; i++) {
        expectObjectsEqual(arr[i], expectedArr[i]);
    }
}

function expectObjectsEqual(obj, expectedObj) {
    for (const [key, value] of Object.entries(expectedObj)) {
        if (typeof value == "object") {
            expectObjectsEqual(obj[key], value);
            continue;
        }
        expect(obj[key]).to.equal(value);
    }
}

exports.expectArraysEqual = expectArraysEqual;