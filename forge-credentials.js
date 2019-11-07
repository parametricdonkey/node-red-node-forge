// Copyright (c) Autodesk, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files(the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and / or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

module.exports = function (RED) {
	"use strict";

	var ForgeAPI = require('forge-apis');

	var localUserCache = {};

	// Forge Config
	function ForgeNode(n) {
		RED.nodes.createNode(this, n);
		this.name = n.name;
		//this.AppName = n.AppName;
		var node = this;
		var promises = [];
		try {
			var out = {};
			if (this.credentials.ClientIDType !== 'flow' && this.credentials.ClientIDType !== 'global')
				this.ClientID = RED.util.evaluateNodeProperty(this.credentials.ClientID, this.credentials.ClientIDType, this.credentials, out);
			else
				promises.push(new Promise(function (fulfill, reject) {
					// Access the node's context object
					var nodeContext = node.context();
					var flowContext = node.context().flow;
					var globalContext = node.context().global;
					//node.ClientID = (node.credentials.ClientIDType === 'global' ? globalContext : flowContext).get('FORGE_CLIENT_ID', 'forge')

					//var redContext = require(require.main.path + "/../@node-red/runtime/lib/nodes/context");
					if (!/^#:\((\S+?)\)::(.*)$/.test(node.credentials.ClientID))
						node.credentials.ClientID = '#:(forge)::' + node.credentials.ClientID;

					RED.util.evaluateNodeProperty(node.credentials.ClientID, node.credentials.ClientIDType, node, out, function (err, res) {
						node.ClientID = err ? '' : res;
						fulfill(node.ClientID);
					});
				}));
			if (this.credentials.ClientSecretType !== 'flow' && this.credentials.ClientSecretType !== 'global')
				this.ClientSecret = RED.util.evaluateNodeProperty(this.credentials.ClientSecret, this.credentials.ClientSecretType, this.credentials, out);
			else
				promises.push(new Promise(function (fulfill, reject) {
					if (!/^#:\((\S+?)\)::(.*)$/.test(node.credentials.ClientSecret))
						node.credentials.ClientSecret = '#:(forge)::' + node.credentials.ClientSecret;
					RED.util.evaluateNodeProperty(node.credentials.ClientSecret, node.credentials.ClientSecretType, node, out, function (err, res) {
						node.ClientSecret = err ? '' : res;
						fulfill(node.ClientSecret);
					});
				}));
			if (this.credentials.CallbackURLType !== 'flow' && this.credentials.CallbackURLType !== 'global')
				this.CallbackURL = RED.util.evaluateNodeProperty(this.credentials.CallbackURL, this.credentials.CallbackURLType, this, out);
			else
				promises.push(new Promise(function (fulfill, reject) {
					if (!/^#:\((\S+?)\)::(.*)$/.test(node.credentials.CallbackURL))
						node.credentials.CallbackURL = '#:(forge)::' + node.credentials.CallbackURL;
					RED.util.evaluateNodeProperty(node.credentials.CallbackURL, node.credentials.CallbackURLType, node.credentials, out, function (err, res) {
						node.CallbackURL = err ? '' : res;
						fulfill(node.CallbackURL);
					});
				}));
		} catch (err) {
			console.error(err);
		}

		this.Scope = n.Scope;
		this.State = n.State;
		this.AccessToken = this.credentials.AccessToken;
		this.proxyRequired = n.proxyRequired;
		this.proxy = n.proxy;

		if (promises.length === 0)
			runOauth(node);
		else
			Promise.all(promises)
			.then(function (values) {
				runOauth(node);
			})
			.catch(function (error) {
				console.error(error);
			});
	}

	function runOauth(node) {
		if (!node.FORGE) {
			node.FORGE = callOauth2Legged(node.ClientID, node.ClientSecret, node.Scope);
			node.FORGE
				.then((response) => {
					node.FORGE = response;
				})
				.catch((error) => {
					node.FORGE = undefined;
					node.error('Forge credentials error' + error);
				});
		}
	}

	RED.nodes.registerType('forge-credentials', ForgeNode, {
		credentials: {
			ClientID: {
				type: 'text',
				value: 'FORGE_CLIENT_ID'
			},
			ClientIDType: {
				type: 'text',
				value: 'env'
			},
			ClientSecret: {
				type: 'text',
				value: 'FORGE_CLIENT_SECRET'
			},
			ClientSecretType: {
				type: 'text',
				value: 'env'
			},
			AccessToken: {
				type: 'text'
			}
		}
	});

	function callOauth2Legged(clientId, clientSecret, scope) {
		return (new Promise(function (fulfill, reject) {
			var oa2Legged = new ForgeAPI.AuthClientTwoLegged(clientId, clientSecret, scope, true);
			oa2Legged.authenticate()
				.then(function (credentials) {
					oa2Legged.__credentials = credentials;
					fulfill(oa2Legged);
				})
				.catch(function (error) {
					reject(error);
				});
		}));
	}

};