//  Change Version
//  npm publish --access public
//  git add .
//  git commit -m fix
//  git push

//  https://github.com/calkoe/node-red-contrib-flowcontrol

//  git add . && git commit && git push && npm publish --access public

const match = function (filter, topic) {
    const filterArray = filter.split('/')
    const length = filterArray.length;
    const topicArray = topic.split('/')
    for (var i = 0; i < length; ++i) {
        var left = filterArray[i]
        var right = topicArray[i]
        if (left === '#') return topicArray.length >= length - 1
        if (left !== '+' && left !== right) return false
    }
    return length === topicArray.length
};

const checkTopic = function(topics,topic){
    for(var t of topics)
        if(match(t, topic)) return true; else continue;
    return false
}

const store = function (global,topic,payload){
    var g  = global.get(topic)||{};
    for(var o in payload) g[o] = [payload[o],new Date];
    g["_lastSeen"] = new Date;
    global.set(topic,g);
}

module.exports = function(RED) {

    var nodes = {};

    //NODE IN
    function flowcontrolIn(config){
        RED.nodes.createNode(this,config);
        var node       = this;
        node.counter   = 0;
        node.on('input', function(msg){

        ///////EQUAL

            //Copy Message
            msg = JSON.parse(JSON.stringify(msg));

            //Make Object
            if(!msg.payload || typeof msg.payload !== 'object') msg.payload = {value:msg.payload};

            //Deny Context
            if(config.context)
                if(msg.payload.Context === config.context || (msg.hap||{}).context === config.context) return;

            //Deny Blacklist Topic
            if(config.blTopic)
                if(checkTopic(config.blTopic.split(","),msg.topic)) return;

            //Deny Blacklist Obj
            if(config.blObj)
                for(var o of config.blObj.split(","))
                    if(o in msg.payload) delete msg.payload[o];

            //Set Context
            if(config.context){
                msg.payload.Context = config.context;
            }

        ///////

            //Set Version
            if(config.version){
                if(!msg.version){msg.version = [];}
                var copy = JSON.parse(JSON.stringify(msg));
                delete copy.version;
                copy.time = new Date;
                msg.version.push(copy);
            }

            //Add to Storage and Send
            if(config.topic||msg.topic){
                for(var t of (config.topic||msg.topic).split(",")){
                    store(this.context().global,t,msg.payload);
    
                    //Find Target Topics
                    for (id in nodes) {
                        if(t && nodes[id].config.topic && checkTopic(nodes[id].config.topic.split(","),t)) flowcontrolOutHandler(msg,nodes[id]);
                    }
    
                    //Status
                    node.counter++;
                    node.status({fill:"blue",shape:"dot",text:node.counter});
                }
            }else{
                node.status({fill:"red",shape:"dot",text:"No topic defined!"});
            }
        
        });
    }

    RED.nodes.registerType("flowcontrolIn",flowcontrolIn);


    //NODE OUT
    function flowcontrolOut(config) {
        RED.nodes.createNode(this,config);
        this.counter            = 0;
        this.config             = config;
        nodes[this.id]          = this;
    }

    function flowcontrolOutHandler(msg,node){
        var config = node.config;

        ///////EQUAL

            //Copy Message
            msg = JSON.parse(JSON.stringify(msg));

            //Make Object
            if(!msg.payload || typeof msg.payload !== 'object') msg.payload = {value:msg.payload};

            //Deny Context
            if(config.context)
                if(msg.payload.Context === config.context || (msg.hap||{}).context === config.context) return;

            //Deny Blacklist Topic
            if(config.blTopic)
                if(checkTopic(config.blTopic.split(","),msg.topic)) return;

            //Deny Blacklist Obj
            if(config.blObj)
                for(var o of config.blObj.split(","))
                    if(o in msg.payload) delete msg.payload[o];

            //Set Context
            if(config.context){
                msg.payload.Context = config.context;
            }

        ///////
        
        //Deny Retained
        if(config.retained)
            if(msg.version && msg.version[0].retain) return;

        //Status
        node.counter++;
        node.status({fill:"blue",shape:"dot",text:node.counter});

        //Send
        node.send(msg);
    };  

    RED.nodes.registerType("flowcontrolOut",flowcontrolOut);

}