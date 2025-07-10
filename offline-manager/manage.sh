#!/bin/bash

# Define ports
FRONTEND_PORT_1=5173
FRONTEND_PORT_2=5174
FRONTEND_PORT_3=5175
BACKEND_PORT=5005

# Find process IDs
get_pids() {
    lsof -t -i:$1
}

# Start command
start() {
    echo "Starting services..."
    if [ -n "$(get_pids $BACKEND_PORT)" ] || [ -n "$(get_pids $FRONTEND_PORT_1)" ] || [ -n "$(get_pids $FRONTEND_PORT_2)" ] || [ -n "$(get_pids $FRONTEND_PORT_3)" ]; then
        echo "Services are already running."
        status
        return
    fi
    npm run dev &> /dev/null &
    echo "Services started in the background."
}

# Stop command
stop() {
    echo "Stopping services..."
    pids_backend=$(get_pids $BACKEND_PORT)
    pids_frontend_1=$(get_pids $FRONTEND_PORT_1)
    pids_frontend_2=$(get_pids $FRONTEND_PORT_2)
    pids_frontend_3=$(get_pids $FRONTEND_PORT_3)

    if [ -n "$pids_backend" ]; then
        kill -9 $pids_backend
        echo "Backend service stopped."
    else
        echo "Backend service not running."
    fi

    if [ -n "$pids_frontend_1" ]; then
        kill -9 $pids_frontend_1
        echo "Frontend service on port $FRONTEND_PORT_1 stopped."
    elif [ -n "$pids_frontend_2" ]; then
        kill -9 $pids_frontend_2
        echo "Frontend service on port $FRONTEND_PORT_2 stopped."
    elif [ -n "$pids_frontend_3" ]; then
        kill -9 $pids_frontend_3
        echo "Frontend service on port $FRONTEND_PORT_3 stopped."
    else
        echo "Frontend service not running on any known port."
    fi
}

# Status command
status() {
    echo "Checking service status..."
    if [ -n "$(get_pids $BACKEND_PORT)" ]; then
        echo "Backend service is RUNNING on port $BACKEND_PORT."
    else
        echo "Backend service is STOPPED."
    fi

    if [ -n "$(get_pids $FRONTEND_PORT_1)" ]; then
        echo "Frontend service is RUNNING on port $FRONTEND_PORT_1."
    elif [ -n "$(get_pids $FRONTEND_PORT_2)" ]; then
        echo "Frontend service is RUNNING on port $FRONTEND_PORT_2."
    elif [ -n "$(get_pids $FRONTEND_PORT_3)" ]; then
        echo "Frontend service is RUNNING on port $FRONTEND_PORT_3."
    else
        echo "Frontend service is STOPPED."
    fi
}

# Restart command
restart() {
    echo "Restarting services..."
    stop
    sleep 2
    start
}

# Help command
help() {
    echo "Usage: $0 {start|stop|status|restart|help}"
    echo
    echo "Commands:"
    echo "  start    Start the frontend and backend services."
    echo "  stop     Stop the frontend and backend services."
    echo "  status   Show the status of the services."
    echo "  restart  Restart the services."
    echo "  help     Show this help message."
}

# Main logic
case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    restart)
        restart
        ;;
    help)
        help
        ;;
    *)
        help
        exit 1
esac

exit 0