// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require('aws-sdk');

const ecs = new AWS.ECS();

exports.handler = async (event) => {
    /**
     * Starts or stops a Fargate Service by setting
     * the task DesiredCount to one or zero
     *
     * @param {object} params
     * @param {boolean} [params.active = false]
     * @param {string} params.serviceName
     * @param {string} params.clusterArn
     */
    console.log('Event: ', JSON.stringify(event));

    try {
        const { params = {} } = event;
        const { active = false, serviceName = '', clusterArn = '' } = params;
        if (!serviceName || !clusterArn) { throw new Error('serviceName and clusterArn are required'); }

        const ecsParams = {
            service: serviceName,
            cluster: clusterArn,
            desiredCount: (active) ? 1 : 0,
        };

        // Update the desired task count
        const { service } = await ecs.updateService(ecsParams).promise();

        // Output the result
        const {
            status, desiredCount, runningCount, pendingCount,
        } = service;
        const result = {
            success: true,
            operation: (active) ? 'start' : 'stop',
            serviceName,
            status,
            desiredCount,
            runningCount,
            pendingCount,
        };
        console.log('Result: ', JSON.stringify(result));
        return result;
    } catch (err) {
        err.message = (err.message) || 'Internal error';
        console.log('Error caught: ', err);
        throw new Error(err);
    }
};
