//npm publish --access public
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

module.exports = function(RED) {

    function flowcontrolIn(config){
        RED.nodes.createNode(this,config);
        var node = this;
        node.on('input', function(msg){

            //Version
            if(config.version){
                if(!msg.version){msg.version = [];}
                msg.version.push(JSON.parse(JSON.stringify(msg)));
            }

            //Check Context
            if(config.context)
            if((msg.payload||{}).Context == config.context || (msg.hap||{}).context == config.context) return;

            //Add to Storage
            var g  = this.context().global.get(config.topic)||{};
            for(var o in msg.payload) g[o] = [msg.payload[o],new Date];
            this.context().global.set(config.topic,g);

            //Set Context
            if(!msg.payload || typeof msg.payload !== 'object'){msg.payload = {};}msg.payload.Context = config.context;

            //Send
            for(var t of (config.topic||msg.topic).split(","))
                RED.events.emit("flowcontrolLoop",{"payload":msg.payload,"topic":t,"version":msg.version,"time":new Date});
        
        });
    }
    RED.nodes.registerType("flowcontrolIn",flowcontrolIn);

    function flowcontrolOut(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        var checkTopic = function(topics,topic){
            for(var t of topics)
                if(match(t, topic)) return true; else continue;
            return false
        }
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
                if(o in msg.payload) return;

            node.send(msg);
        }
        RED.events.on("flowcontrolLoop",handler);
    }
    RED.nodes.registerType("flowcontrolOut",flowcontrolOut);



}