// eslint-disable-next-line import/no-extraneous-dependencies
import { ECS } from 'aws-sdk';

const ecs = new ECS();

type EventProps = {
    params: {
        active: boolean,
        serviceName: string,
        clusterArn: string,
    },
};

/**
 * Starts or stops a Fargate Service by setting
 * the task DesiredCount to one or zero
 */
export const handler = async (event: EventProps) => {
    console.log('Event: ', JSON.stringify(event));

    try {
        const { params } = event;
        const { active = false, serviceName = '', clusterArn = '' } = params;
        if (!serviceName || !clusterArn) { throw new Error('serviceName and clusterArn are required'); }

        const ecsParams = {
            service: serviceName,
            cluster: clusterArn,
            desiredCount: (active) ? 1 : 0,
        };

        // Update the desired task count
        const {
            status, desiredCount, runningCount, pendingCount,
        } = (await ecs.updateService(ecsParams).promise()).service as ECS.Service;

        // Output the result
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
        console.log('Error caught: ', err);
        throw err;
    }
};
