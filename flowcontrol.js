//  npm publish --access public
//  git add .
//  git commit
//  git push

const match = function (filter, topic) {
    const filterArray = filter.split('/')
    const length = filterArray.length
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
    global.set(topic,g);
}

module.exports = function(RED) {

    //NODE IN
    function flowcontrolIn(config){
        RED.nodes.createNode(this,config);
        var node = this;
        node.on('input', function(msg){

            //Deny Context
            if(config.context)
            if((msg.payload||{}).Context == config.context || (msg.hap||{}).context == config.context) return;
            
            //Set Context
            if(!msg.payload || typeof msg.payload !== 'object'){msg.payload = {value:msg.payload};}msg.payload.Context = config.context;

             //Version
             if(config.version){
                if(!msg.version){msg.version = [];}
                var copy = JSON.parse(JSON.stringify(msg));
                delete copy.version;
                copy.time = new Date;
                msg.version.push(copy);
            }

            //Add to Storage and Send
            for(var t of (config.topic||msg.topic).split(",")){
                store(this.context().global,t,msg.payload);
                RED.events.emit("flowcontrolLoop",{"payload":msg.payload,"topic":t,"version":msg.version});
            }
        
        });
    }
    RED.nodes.registerType("flowcontrolIn",flowcontrolIn);


    //NODE OUT
    function flowcontrolOut(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        var handler = function(msg){
            
            //Topic
            if(config.topic)
            if(!checkTopic(config.topic.split(","),msg.topic)) return;

            //Context
            if(config.context)
            if((msg.payload||{}).Context == config.context || (msg.hap||{}).context == config.context) return;
            
            //Retained
            if(config.retained)
            if(msg.version && msg.version[0].retain) return;

            //Blacklist Topic
            if(config.blTopic)
            if(checkTopic(config.blTopic.split(","),msg.topic)) return;

            //Blacklist Obj
            if(config.blObj)
            for(var o of config.blObj.split(","))
                if(o in msg.payload) delete msg.payload[o];

            node.send(msg);
        }
        RED.events.on("flowcontrolLoop",handler);
    }
    RED.nodes.registerType("flowcontrolOut",flowcontrolOut);

}